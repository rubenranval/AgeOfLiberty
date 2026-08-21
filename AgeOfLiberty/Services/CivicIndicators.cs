using System;
using System.Collections.Generic;
using System.Linq;
using AgeOfLiberty.Models;

namespace AgeOfLiberty.Services;

// ═══════════════════════════════════════════════════════════════════════════
// CIVIC INDICATORS — NationStates-style derived metrics.
// Pure functions over GameState + GameConfig. Zero API changes: atom
// semantics come from the slug→tag table below; everything else is already
// in the save (Built, PriceMultipliers, ChoiceEvents, histories).
//
// Requires (user-side, GameState.cs):
//     public List<IndicatorSnapshot> IndicatorHistory { get; set; } = new();
// ═══════════════════════════════════════════════════════════════════════════

public class IndicatorSnapshot
{
    public int Turn { get; set; }
    public double[] V { get; set; } = Array.Empty<double>();   // normalized 0–100, indexed by metric id
}

public class Influence
{
    public string Text { get; set; } = "";
    public bool Positive { get; set; }
}

public static class CivicIndicators
{
    // ─── Metric registry ─────────────────────────────────────────────────
    public const int Liberty = 0, Criminality = 1, LifeExpectancy = 2, AirQuality = 3,
                     Education = 4, MarketDistortion = 5, Prosperity = 6, Industry = 7,
                     Bureaucracy = 8, Laziness = 9, Politeness = 10, Deterrence = 11,
                     CivicMood = 12;
    public const int Count = 13;

    public static readonly string[] Names = {
        "Liberty Index", "Criminality", "Life Expectancy", "Air Quality",
        "Education", "Market Distortion", "Prosperity", "Industry",
        "Bureaucracy", "Laziness", "Politeness", "Deterrence", "Civic Mood"
    };

    public static readonly string[] Descriptions = {
        "How freely your citizens may trade, build, speak, and leave. The average of every decision you have ever made, remembered forever.",
        "Crowded housing, thin wallets, and every market you have banned — each banned market reopens at night, without receipts.",
        "How long a citizen can reasonably expect to keep being one. Era medicine raises it; whatever is in the air lowers it.",
        "The breathability of prosperity. Furnaces and engines put things into the sky; cleaner machines put considerably fewer.",
        "How much your citizens know, and how fast they can find out more. Grows with every wire, wave, and network you build.",
        "How far prices have drifted from what buyers and sellers would agree on. Every decree leaves a fingerprint on a price tag.",
        "Gold per citizen and the speed at which more arrives. The only indicator your treasurer reads twice.",
        "The hum of the city: furnaces, factories, and fabricators per capita. Some eras hum louder than others.",
        "The paperwork density of daily life. Every intervention needs a form; every form needs a department; every department needs more forms.",
        "What citizens do when machines do the rest. Rises with automation and comfort; falls when there is real work to be done.",
        "Queue discipline, apology frequency, and general civility. Educated, safe, uncrowded citizens say 'excuse me' more.",
        "The city's capacity to discourage unpleasant surprises. Neighboring cities keep an eye on it, politely.",
        "The overall temperature of the citizenry — safety, wealth, air, liberty, and manners, blended into one word of civic weather."
    };

    // Metrics where past decisions (ChoiceEvents) are the main driver → chart markers
    public static readonly bool[] DecisionDriven = {
        true, true, false, false, false, true, false, false, true, false, false, false, true
    };

    // Higher-is-better flags (for coloring trends; Criminality/Distortion/Bureaucracy/Laziness inverted)
    public static readonly bool[] HigherIsBetter = {
        true, false, true, true, true, false, true, true, false, false, true, true, true
    };

    // ─── Atom tag table (slug → tags) ────────────────────────────────────
    static readonly string[] None = Array.Empty<string>();
    static readonly Dictionary<string, string[]> AtomTags = new()
    {
        ["coal"] = new[] { "dirty" },
        ["oil"] = new[] { "dirty" },
        ["shale_gas"] = new[] { "dirty" },
        ["steam_engine"] = new[] { "dirty", "industry" },
        ["automobile"] = new[] { "dirty" },
        ["water_mill"] = new[] { "clean" },
        ["turbine"] = new[] { "clean", "industry" },
        ["nuclear_power"] = new[] { "clean" },
        ["fusion_reactor"] = new[] { "clean" },
        ["lithium_battery"] = new[] { "clean" },
        ["antimatter"] = new[] { "clean", "arms" },     // the annihilation reserve is not discussed
        ["antibiotics"] = new[] { "health" },
        ["lab_grown_meat"] = new[] { "health" },
        ["nanobots"] = new[] { "health", "auto" },
        ["synthetic_womb"] = new[] { "health" },
        ["brain_implant"] = new[] { "health", "media" },
        ["telegraph"] = new[] { "media" },
        ["radio"] = new[] { "media" },
        ["internet"] = new[] { "media" },
        ["smartphone"] = new[] { "media" },
        ["space_datacenter"] = new[] { "media", "auto" },
        ["quantum_computer"] = new[] { "media", "auto" },
        ["ai_chip"] = new[] { "media", "industry", "auto" },
        ["gunpowder"] = new[] { "arms" },
        ["jet_engine"] = new[] { "arms" },
        ["rocket"] = new[] { "arms" },
        ["drone"] = new[] { "arms", "auto" },
        ["steel"] = new[] { "industry" },
        ["cement"] = new[] { "industry" },
        ["locomotive"] = new[] { "industry" },
        ["plastic"] = new[] { "industry" },
        ["microchip"] = new[] { "industry" },
        ["smart_matter"] = new[] { "industry", "auto" },
        ["megastructure"] = new[] { "industry" },
    };

    static string[] TagsOf(Atom a) => AtomTags.GetValueOrDefault(a.Slug ?? "", None);

    static long TagCount(GameState s, GameConfigStore c, string tag)
    {
        long n = 0;
        foreach (var a in c.Atoms)
            if (TagsOf(a).Contains(tag)) n += s.GetBuiltCount(a.Id);
        return n;
    }

    static double Clamp01(double v) => Math.Clamp(v, 0, 1);
    static double C(double v) => Math.Clamp(v, 0, 100);

    // ─── Core computation ────────────────────────────────────────────────
    public static double[] ComputeAll(GameState s, GameConfigStore c, long incomeRate)
    {
        var v = new double[Count];
        double pop = Math.Max(1, s.Population);
        int era = Math.Max(0, c.GetEraIndex(s.Population));

        double housingW = c.Atoms.Where(a => a.HousingWeight > 0)
                                 .Sum(a => s.GetBuiltCount(a.Id) * a.HousingWeight);
        double crowding = Clamp01(pop / Math.Max(30.0, housingW * 6.5));
        double wealthPC = s.Gold / pop;

        var events = s.ChoiceEvents ?? new List<ChoiceEvent>();
        int interventions = events.Count(e => e.FreedomWeight < 0);
        double interventionShare = events.Count == 0 ? 0 : (double)interventions / events.Count;

        double distortion = 0; int distorted = 0;
        foreach (var kv in s.PriceMultipliers)
        {
            var d = Math.Abs(kv.Value - 1.0);
            if (d > 0.02) { distortion += d; distorted++; }
        }
        distortion = distorted == 0 ? 0 : distortion / distorted;

        long dirty = TagCount(s, c, "dirty"), clean = TagCount(s, c, "clean");
        long health = TagCount(s, c, "health"), media = TagCount(s, c, "media");
        long industry = TagCount(s, c, "industry"), arms = TagCount(s, c, "arms");
        long auto_ = TagCount(s, c, "auto");

        // 0 · Liberty — the existing score, unchanged
        var fs = s.ComputeFreedomScore();
        v[Liberty] = fs.Score;

        // 1 · Criminality
        double pressure = 38 * crowding
                        + 27 * Math.Max(0, 1 - wealthPC / 60.0)
                        + 25 * interventionShare
                        + 10 * Clamp01(distortion * 2.5);
        v[Criminality] = C(pressure);

        // 2 · Life Expectancy (stored normalized; DisplayValue converts to years)
        double dirtyPC = dirty / pop * 10.0;
        double years = 38 + era * 8
                     + Math.Min(14, 3 * Math.Log2(1 + health))
                     - Math.Min(9, dirtyPC * 4);
        v[LifeExpectancy] = C((years - 35) / 60.0 * 100);

        // 3 · Air Quality (industrial-era furnaces weigh heavier)
        double dirtyW = dirty * (era is >= 1 and <= 3 ? 1.5 : 1.0);
        double cleanShare = (clean + dirtyW) == 0 ? 0.5 : clean / (double)(clean + dirtyW);
        v[AirQuality] = C(100 - 55 * Clamp01(dirtyW / pop * 10) + 25 * (cleanShare - 0.5) * 2 - 8 * Clamp01(industry / pop * 6));

        // 4 · Education
        v[Education] = C(100 * (0.22 + 0.55 * Clamp01(media / pop * 6) + era * 0.045));

        // 5 · Market Distortion
        v[MarketDistortion] = C(100 * Clamp01(distortion * 1.6));

        // 6 · Prosperity
        v[Prosperity] = C(100 * Clamp01(incomeRate / pop / 3.0 + wealthPC / 400.0));

        // 7 · Industry
        v[Industry] = C(100 * Clamp01((industry + dirty) / pop * 4.0) + era * 2);

        // 8 · Bureaucracy (score; DisplayValue also renders the forms count)
        v[Bureaucracy] = C(100 * interventionShare * (0.65 + 0.09 * era)
                         + 9 * Math.Log(1 + interventions));

        // 9 · Laziness
        v[Laziness] = C(100 * (0.18
                        + 0.55 * Clamp01(auto_ / pop * 5)
                        + 0.22 * (v[Prosperity] / 100.0)
                        - 0.28 * Clamp01((industry + dirty) / pop * 3)));

        // 10 · Politeness
        v[Politeness] = C(0.40 * v[Education] + 0.35 * (100 - v[Criminality]) + 0.25 * (100 - crowding * 100));

        // 11 · Deterrence (antimatter counts eightfold; we do not discuss the reserve)
        long am = c.Atoms.Where(a => a.Slug == "antimatter").Sum(a => s.GetBuiltCount(a.Id));
        v[Deterrence] = C(100 * Clamp01((arms + am * 7) / pop * 6.0) + era * 2.5);

        // 12 · Civic Mood — the headline composite
        v[CivicMood] = C(0.24 * v[Liberty] + 0.22 * (100 - v[Criminality]) + 0.20 * v[Prosperity]
                       + 0.17 * v[AirQuality] + 0.17 * v[Politeness]);

        return v;
    }

    // ─── History recording (call once per turn from the UI state hook) ───
    public const int MaxHistory = 600;

    public static void RecordIfNewTurn(GameState s, GameConfigStore c, long incomeRate)
    {
        var h = s.IndicatorHistory;
        if (h.Count > 0 && h[^1].Turn >= s.Turn) return;
        h.Add(new IndicatorSnapshot { Turn = s.Turn, V = ComputeAll(s, c, incomeRate) });
        if (h.Count > MaxHistory) h.RemoveRange(0, h.Count - MaxHistory);
    }

    // ─── Display ─────────────────────────────────────────────────────────
    public static string DisplayValue(int metric, double v, GameState s, GameConfigStore c)
    {
        switch (metric)
        {
            case LifeExpectancy: return $"{35 + v * 0.6:F0} years";
            case Bureaucracy:
                var events = s.ChoiceEvents ?? new List<ChoiceEvent>();
                int i = events.Count(e => e.FreedomWeight < 0);
                int era = Math.Max(0, c.GetEraIndex(s.Population));
                long forms = (long)(Math.Pow(i, 1.6) * 137 * (era + 1)) + (long)s.Turn * i;
                return $"{forms:N0} forms";
            default: return $"{v:F0}";
        }
    }

    public static string Grade(double v) => v switch
    {
        >= 85 => "A+",
        >= 70 => "A",
        >= 55 => "B",
        >= 40 => "C",
        >= 25 => "D",
        _ => "F"
    };

    // ─── The other cities (simulated, deterministic, entirely fictional) ─
    static readonly double[] SimBias = { 44, 52, 54, 47, 50, 54, 47, 51, 58, 49, 50, 45, 48 };

    public static double SimAvg(int metric, int turn) =>
        Math.Clamp(SimBias[metric]
            + 10 * Math.Sin(turn / 41.0 + metric * 1.7)
            + 5 * Math.Sin(turn / 12.3 + metric * 3.1), 8, 92);

    // ─── Tier lines ──────────────────────────────────────────────────────
    static readonly string[][] Tiers = {
        new[]{ // Liberty (low→high)
            "The Five-Year Plan is on schedule. The schedule is classified.",
            "Most things are permitted, pending the right stamp.",
            "The market breathes, between regulations.",
            "Trade flows; the ministries mostly watch.",
            "The city runs itself. The government takes minutes." },
        new[]{ // Criminality (low→high)
            "Doors are left unlocked. Nobody remembers why they have keys.",
            "The constable's most serious open case involves a duck.",
            "Pickpockets operate with published rates.",
            "The locksmiths' guild has entered politics.",
            "Crime is the third-largest employer, and it is hiring." },
        new[]{ // Life Expectancy (low→high)
            "The doctors recommend not being alive during smog season.",
            "Retirement is a rumor from other cities.",
            "Citizens live long enough to complain about it.",
            "Grandparents outnumber their own predictions.",
            "The cemetery has a waiting list — from lack of custom." },
        new[]{ // Air Quality (low→high)
            "The air is best described as chewable.",
            "Laundry is dried indoors, as a lifestyle.",
            "The sunsets are spectacular and slightly flammable.",
            "Occasionally, a smell of progress.",
            "Mountain air, without the mountain." },
        new[]{ // Education (low→high)
            "The library is popular for its roof.",
            "Reading is respected from a safe distance.",
            "Most citizens can name a philosopher and both mayors.",
            "The bakery queue debates monetary policy.",
            "Citizens argue epistemology at breakfast, and win." },
        new[]{ // Market Distortion (low→high)
            "Prices speak freely, and are occasionally rude.",
            "A few prices walk with a government limp.",
            "Half the prices are opinions.",
            "Prices are negotiated with the Ministry, by appointment.",
            "Prices are assigned by committee and enforced by nostalgia." },
        new[]{ // Prosperity (low→high)
            "The treasury echoes beautifully.",
            "Comfortable, if nobody asks about the roof.",
            "Comfortable, with occasional envy of the neighbors.",
            "The middle class has opinions about wine now.",
            "Wallets require structural reinforcement." },
        new[]{ // Industry (low→high)
            "Principal export: potential.",
            "The workshops keep respectable hours.",
            "The city hums. The hum has a union.",
            "Three shifts, two shortages, one skyline of chimneys.",
            "The city manufactures everything, including its own noise." },
        new[]{ // Bureaucracy (low→high)
            "Form 1 exists but has never been needed.",
            "Paperwork is measured in pages, not buildings.",
            "There is a form for requesting forms. It is Form 77.",
            "The Records Office has its own weather.",
            "The cabinets, citizen, go all the way down." },
        new[]{ // Laziness (low→high)
            "Idleness is theoretical; the fields disagree.",
            "Rest is scheduled, and the schedule is respected.",
            "The lunch hour has annexed part of the afternoon.",
            "Citizens nap competitively. There are rankings.",
            "The machines work. The citizens supervise, from hammocks." },
        new[]{ // Politeness (low→high)
            "Queue-jumping is now a licensed profession.",
            "Apologies exist, but are considered a weakness.",
            "Doors are held, grudgingly, for the deserving.",
            "Apologies are exchanged before collisions.",
            "Duels are fought over who apologizes first." },
        new[]{ // Deterrence (low→high)
            "The militia is a book club with a cannon.",
            "The armory is dusted weekly, fired never.",
            "The parade is short but sincere.",
            "Neighboring cities send very polite letters.",
            "Neighboring cities apologize preemptively." },
        new[]{ // Civic Mood (low→high)
            "Pre-Revolutionary",
            "Organized Discontent",
            "Productively Grumbling",
            "Cautiously Thriving",
            "Insufferably Content" },
    };

    public static string TierLine(int metric, double v)
    {
        int tier = v switch { < 20 => 0, < 40 => 1, < 60 => 2, < 80 => 3, _ => 4 };
        return Tiers[metric][tier];
    }

    // ─── Influences: what moved this metric ──────────────────────────────
    public static List<Influence> GetInfluences(int metric, GameState s, GameConfigStore c)
    {
        var res = new List<Influence>();
        var events = (s.ChoiceEvents ?? new List<ChoiceEvent>()).ToList();

        void AtomRows(string tag, bool positive, string suffix)
        {
            foreach (var a in c.Atoms.Where(a => TagsOf(a).Contains(tag)))
            {
                var n = s.GetBuiltCount(a.Id);
                if (n > 0) res.Add(new Influence { Text = $"{a.Name} ×{n} — {suffix}", Positive = positive });
            }
        }

        switch (metric)
        {
            case Liberty:
            case CivicMood:
                foreach (var e in events.AsEnumerable().Reverse().Take(6))
                    res.Add(new Influence { Text = $"T{e.Turn} · {Trim(e.Label)}", Positive = e.FreedomWeight >= 0 });
                break;

            case Bureaucracy:
                foreach (var e in events.Where(e => e.FreedomWeight < 0).AsEnumerable().Reverse().Take(6))
                    res.Add(new Influence { Text = $"T{e.Turn} · {Trim(e.Label)} — forms spawned", Positive = false });
                if (res.Count == 0)
                    res.Add(new Influence { Text = "No interventions on record. The Records Office worries.", Positive = true });
                break;

            case Criminality:
                foreach (var e in events.Where(e => e.FreedomWeight < 0).AsEnumerable().Reverse().Take(4))
                    res.Add(new Influence { Text = $"T{e.Turn} · {Trim(e.Label)} — black market seeded", Positive = false });
                break;

            case MarketDistortion:
                foreach (var e in events.AsEnumerable().Reverse())
                {
                    foreach (var kv in e.Multipliers.Where(m => Math.Abs(m.Value - 1) >= 0.1).Take(2))
                    {
                        var name = c.AtomsById.GetValueOrDefault(kv.Key)?.Name ?? "?";
                        var pct = (kv.Value - 1) * 100;
                        res.Add(new Influence { Text = $"T{e.Turn} · {name} {(pct >= 0 ? "+" : "")}{pct:F0}%", Positive = Math.Abs(kv.Value - 1) < 0.15 });
                    }
                    if (res.Count >= 6) break;
                }
                break;

            case AirQuality: AtomRows("dirty", false, "into the sky"); AtomRows("clean", true, "clean power"); break;
            case LifeExpectancy: AtomRows("health", true, "medicine"); AtomRows("dirty", false, "smog"); break;
            case Education: AtomRows("media", true, "knowledge network"); break;
            case Industry: AtomRows("industry", true, "the hum"); AtomRows("dirty", true, "the hum, louder"); break;
            case Laziness: AtomRows("auto", true, "does the work"); break;
            case Politeness:
                res.Add(new Influence { Text = "Composite: education, safety, and elbow room", Positive = true });
                break;
            case Deterrence: AtomRows("arms", true, "on parade"); break;
            case Prosperity:
                res.Add(new Influence { Text = $"Treasury per citizen: ${s.Gold / Math.Max(1, s.Population):N0}", Positive = true });
                break;
        }

        if (res.Count == 0)
            res.Add(new Influence { Text = "Nothing on record influences this yet.", Positive = true });
        return res.Take(6).ToList();
    }

    static string Trim(string s) => s.Length <= 34 ? s : s[..34] + "…";
}