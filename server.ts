import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_NAME = "gemini-4-hydrogen";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw Object.assign(
      new Error(
        "GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets."
      ),
      { statusCode: 503 }
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function handleGeminiError(err: unknown, res: Response): void {
  const errorObj = err as { statusCode?: number; status?: number; message?: string };
  const rawMessage = errorObj?.message || "Unexpected server error while calling Gemini API.";
  const status = errorObj?.statusCode || errorObj?.status || 500;

  if (
    rawMessage.includes("API_KEY_INVALID") ||
    (status === 400 && rawMessage.toLowerCase().includes("api key"))
  ) {
    res.status(400).json({
      error: "The configured Gemini API key appears invalid. Please verify it in Settings > Secrets.",
    });
    return;
  }
  if (status === 403 || rawMessage.includes("PERMISSION_DENIED")) {
    res.status(403).json({
      error: "Permission denied by Gemini API. Please check your API key in Settings > Secrets.",
    });
    return;
  }
  if (status === 429 || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    res.status(429).json({
      error: "Rate limit or quota reached for the Gemini API. Please wait a moment and try again.",
    });
    return;
  }

  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: rawMessage,
  });
}

const TAILOR_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    jobAnalysis: {
      type: Type.OBJECT,
      properties: {
        roleTitle: { type: Type.STRING },
        companyName: { type: Type.STRING },
        recipientContact: { type: Type.STRING },
        recipientAddress: { type: Type.STRING },
        location: { type: Type.STRING },
        startDate: { type: Type.STRING },
        duration: { type: Type.STRING },
        overview: { type: Type.STRING },
        hardSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
        softSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
        languageRequirement: { type: Type.STRING },
        requirementMatches: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              requirement: { type: Type.STRING },
              category: { type: Type.STRING },
              evidenceFromProfile: { type: Type.STRING },
              strength: { type: Type.STRING },
            },
            required: ["requirement", "category", "evidenceFromProfile", "strength"],
          },
        },
        gapsOrActionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        "roleTitle",
        "companyName",
        "recipientContact",
        "recipientAddress",
        "location",
        "startDate",
        "duration",
        "overview",
        "hardSkills",
        "softSkills",
        "languageRequirement",
        "requirementMatches",
        "gapsOrActionItems",
      ],
    },
    tailoredCv: {
      type: Type.OBJECT,
      properties: {
        headline: { type: Type.STRING },
        profileStatement: { type: Type.STRING },
        experience: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              period: { type: Type.STRING },
              role: { type: Type.STRING },
              organization: { type: Type.STRING },
              location: { type: Type.STRING },
              bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["period", "role", "organization", "location", "bullets"],
          },
        },
        education: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              period: { type: Type.STRING },
              degree: { type: Type.STRING },
              institution: { type: Type.STRING },
              location: { type: Type.STRING },
              details: { type: Type.STRING },
            },
            required: ["period", "degree", "institution", "location", "details"],
          },
        },
        skills: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              items: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["category", "items"],
          },
        },
        languages: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              language: { type: Type.STRING },
              level: { type: Type.STRING },
            },
            required: ["language", "level"],
          },
        },
        interests: { type: Type.STRING },
      },
      required: [
        "headline",
        "profileStatement",
        "experience",
        "education",
        "skills",
        "languages",
        "interests",
      ],
    },
    tailoredCoverLetter: {
      type: Type.OBJECT,
      properties: {
        senderBlock: { type: Type.STRING },
        recipientBlock: { type: Type.STRING },
        datePlaceLine: { type: Type.STRING },
        subjectLine: { type: Type.STRING },
        salutation: { type: Type.STRING },
        paragraphs: { type: Type.ARRAY, items: { type: Type.STRING } },
        closing: { type: Type.STRING },
        signatureName: { type: Type.STRING },
        englishSummary: { type: Type.STRING },
      },
      required: [
        "senderBlock",
        "recipientBlock",
        "datePlaceLine",
        "subjectLine",
        "salutation",
        "paragraphs",
        "closing",
        "signatureName",
        "englishSummary",
      ],
    },
    tailoringNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["jobAnalysis", "tailoredCv", "tailoredCoverLetter", "tailoringNotes"],
};

const PARSE_CV_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    fullName: { type: Type.STRING },
    email: { type: Type.STRING },
    phone: { type: Type.STRING },
    streetAddress: { type: Type.STRING },
    postalCity: { type: Type.STRING },
    birthInfo: { type: Type.STRING },
    nationality: { type: Type.STRING },
    availability: { type: Type.STRING },
    linkedInOrPortfolio: { type: Type.STRING },
    summary: { type: Type.STRING },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          period: { type: Type.STRING },
          role: { type: Type.STRING },
          organization: { type: Type.STRING },
          location: { type: Type.STRING },
          highlights: { type: Type.STRING },
        },
        required: ["period", "role", "organization", "location", "highlights"],
      },
    },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          period: { type: Type.STRING },
          degree: { type: Type.STRING },
          institution: { type: Type.STRING },
          location: { type: Type.STRING },
          details: { type: Type.STRING },
        },
        required: ["period", "degree", "institution", "location", "details"],
      },
    },
    skills: { type: Type.STRING },
    languages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          language: { type: Type.STRING },
          level: { type: Type.STRING },
        },
        required: ["language", "level"],
      },
    },
    interests: { type: Type.STRING },
  },
  required: [
    "fullName",
    "email",
    "phone",
    "streetAddress",
    "postalCity",
    "birthInfo",
    "nationality",
    "availability",
    "linkedInOrPortfolio",
    "summary",
    "experience",
    "education",
    "skills",
    "languages",
    "interests",
  ],
};

function sanitizeProfileForAi(profile: Record<string, unknown>) {
  // Exclude large base64 photo data URL from LLM prompt to keep latency low
  const { photoUrl: _omitPhoto, ...rest } = profile;
  return rest;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "6mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    const hasKey = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
    );
    res.json({ ok: true, aiConfigured: hasKey });
  });

  app.post("/api/tailor", async (req: Request, res: Response) => {
    try {
      const { profile, jobDescription, targetCompany, targetRole, language, tone } = req.body ?? {};

      if (!jobDescription || typeof jobDescription !== "string" || !jobDescription.trim()) {
        res.status(400).json({ error: "Please paste a job description (Stellenanzeige) to analyze." });
        return;
      }
      if (!profile || typeof profile !== "object" || !profile.fullName) {
        res
          .status(400)
          .json({ error: "Please add at least your name and background in Base Profile first." });
        return;
      }

      const ai = getGeminiClient();

      const languageInstruction =
        language === "en"
          ? "Write both the tailored CV and cover letter in clear, professional English tailored to German company expectations."
          : language === "de_with_notes"
          ? "Write both the tailored CV (Lebenslauf) and cover letter (Anschreiben) in natural, idiomatic, error-free German (Sie-Anrede). Provide the jobAnalysis overview, gapsOrActionItems, tailoringNotes, and cover letter englishSummary in clear English so the applicant understands every detail."
          : "Write both the tailored CV (Lebenslauf) and cover letter (Anschreiben) in natural, idiomatic, error-free German (Sie-Anrede). Also provide a concise English summary in englishSummary and clear actionable notes.";

      const toneInstruction =
        tone === "technical"
          ? "Tone: precise, technical, hands-on, highlighting concrete tools, problem-solving, and analytical mindset."
          : tone === "modern"
          ? "Tone: modern, motivated, personable yet respectful (authentic German mid-sized/tech company style, avoiding stiff clichés like 'Hiermit bewerbe ich mich...')."
          : "Tone: classic, structured, formal German business standard (seriös, präzise, verbindlich).";

      const systemInstruction = `You are a senior German career advisor specializing in "Ausbildung" (dual vocational training) applications in Germany (Europass, IHK / HWK, and DIN 5008 standards) optimized for Applicant Tracking Systems (ATS).

CRITICAL RULES:
1. STRICT TRUTHFULNESS: Never fabricate degrees, employers, internships, certificates, grades, or language levels not present in the Candidate Profile. Rephrase, prioritize, and connect ONLY genuine facts, school subjects, projects, internships, and transferable soft skills from the Candidate Profile to the job description. If a job requirement is missing from the profile (for example, a specific certificate or driver's license), explicitly mark strength as "gap" in requirementMatches and note it honestly in gapsOrActionItems.
2. EUROPASS + ATS-OPTIMIZED LEBENSLAUF FIELDS:
   - headline: Exact target Ausbildungsberuf matching the job posting title (e.g., "Bewerbung um einen Ausbildungsplatz als Fachinformatiker für Anwendungsentwicklung").
   - profileStatement: 2-3 clear, keyword-rich sentences connecting the candidate's real background to this company's core requirements.
   - experience: Rewrite each genuine experience/internship/project role title and bullets using action verbs and relevant terminology from the job ad. Use MM/YYYY – MM/YYYY date format where known.
   - skills: Group skills into ATS-clear categories (e.g., "Digitale Kompetenzen", "Fachliche Grundlagen", "Soziale & organisatorische Kompetenzen") placing exact matching keywords from the job description first.
   - languages: List language name and clear CEFR level (e.g., "B2", "C1", "Muttersprache (C2)").
3. GERMAN ANSCHREIBEN (DIN 5008 / EUROPASS COVER LETTER):
   - Format senderBlock (Name, Street, Postal/City, Phone, Email separated by newlines), recipientBlock (Company, Contact person if known e.g. "Frau Katrin Weber" or "Personalabteilung", Street/Postal/City from job ad), datePlaceLine (e.g., "Düsseldorf, ${new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}").
   - Strong subjectLine: e.g. "Bewerbung um einen Ausbildungsplatz als [Exact Role]".
   - Proper salutation: "Sehr geehrte Frau [LastName]," / "Sehr geehrter Herr [LastName]," if named in the job ad, otherwise "Sehr geehrte Damen und Herren,".
   - Body paragraphs (3 to 4 tight paragraphs, ~230-310 words total so it fits cleanly on ONE DIN A4 page).
   - Closing: "Mit freundlichen Grüßen" (or "Sincerely," if English).
4. ${languageInstruction}
5. ${toneInstruction}
6. For requirementMatches[].strength, only use one of: "strong", "transferable", or "gap". Keep requirementMatches concise (5 to 7 key requirements).`;

      const userPrompt = `TARGET OVERRIDES (if non-empty, prioritize these):
Target Company: ${targetCompany || "(extract from job description)"}
Target Role: ${targetRole || "(extract from job description)"}

CANDIDATE MASTER PROFILE:
${JSON.stringify(sanitizeProfileForAi(profile), null, 2)}

JOB DESCRIPTION (STELLENANZEIGE):
${jobDescription}`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: userPrompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: TAILOR_RESPONSE_SCHEMA,
        },
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error("Model returned an empty response.");
      }

      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (err) {
      handleGeminiError(err, res);
    }
  });

  app.post("/api/refine", async (req: Request, res: Response) => {
    try {
      const { profile, jobDescription, currentPackage, targetSection, instruction, language } =
        req.body ?? {};

      if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
        res.status(400).json({ error: "Please enter a refinement instruction." });
        return;
      }
      if (!currentPackage) {
        res.status(400).json({ error: "No tailored application package provided to refine." });
        return;
      }

      const ai = getGeminiClient();

      const systemInstruction = `You are refining an existing tailored German Ausbildung application package (Lebenslauf and/or DIN 5008 Anschreiben).
Follow the user's refinement instruction precisely while strictly preserving truthfulness against the Candidate Profile (never invent fake experience or qualifications).
Target section to focus on: ${targetSection || "both"}.
Output language mode: ${language || "de_with_notes"}.
Return the complete updated JSON object matching the schema.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `REFINEMENT INSTRUCTION:
${instruction}

CANDIDATE PROFILE:
${JSON.stringify(profile ? sanitizeProfileForAi(profile) : {}, null, 2)}

JOB DESCRIPTION:
${jobDescription}

CURRENT TAILORED PACKAGE:
${JSON.stringify(currentPackage, null, 2)}`,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: TAILOR_RESPONSE_SCHEMA,
        },
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error("Model returned an empty response.");
      }

      res.json(JSON.parse(rawText));
    } catch (err) {
      handleGeminiError(err, res);
    }
  });

  app.post("/api/parse-cv", async (req: Request, res: Response) => {
    try {
      const { rawText } = req.body ?? {};
      if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
        res.status(400).json({ error: "Please paste CV or resume text to import." });
        return;
      }

      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Extract structured candidate profile fields from the following CV/resume text. Leave unknown fields as empty string "" or empty arrays []. Do not invent missing information.\n\nCV TEXT:\n${rawText}`,
        config: {
          systemInstruction:
            "You accurately extract structured candidate profile information from raw CV or resume text in German or English without inventing any facts.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: PARSE_CV_SCHEMA,
        },
      });

      const parsedText = response.text;
      if (!parsedText) {
        throw new Error("Model returned an empty response.");
      }

      res.json(JSON.parse(parsedText));
    } catch (err) {
      handleGeminiError(err, res);
    }
  });

  // Ensure any unknown /api/* route returns JSON instead of falling through to HTML SPA fallback
  app.all("/api/{*path}", (_req: Request, res: Response) => {
    res.status(404).json({ error: "API route not found." });
  });

  // Ensure Express middleware errors (like malformed JSON or payload too large) return JSON, not HTML
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/")) {
      handleGeminiError(err, res);
      return;
    }
    next(err);
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Ausbildung Studio server listening on http://localhost:${port}`);
  });
}

startServer();
