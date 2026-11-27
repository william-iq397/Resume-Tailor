import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_NAME = "gemini-3.1-flash-lite";
const FALLBACK_MODEL_NAME = "gemini-4-hydrogen";

function getFirebaseProjectId(): string | null {
  try {
    const configPath = path.resolve(__dirname, "firebase-applet-config.json");
    if (!fs.existsSync(configPath)) return null;
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as { projectId?: string };
    if (!raw.projectId || raw.projectId === "remixed-project-id") return null;
    return raw.projectId;
  } catch {
    return null;
  }
}

function getFirebaseAdminAuth() {
  const projectId = getFirebaseProjectId();
  if (!projectId) {
    throw Object.assign(
      new Error("إعدادات Firebase غير مكتملة على الخادم."),
      { statusCode: 503 }
    );
  }
  const firebaseApp = getApps().length ? getApp() : initializeApp({ projectId });
  return getAuth(firebaseApp);
}

async function requireFirebaseAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "يرجى تسجيل الدخول بحساب Google أولاً." });
    return;
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    if (!decoded.email_verified) {
      res.status(403).json({ error: "يرجى تأكيد البريد الإلكتروني لحسابك أولاً." });
      return;
    }
    (req as Request & { authUser?: { uid: string; email?: string } }).authUser = {
      uid: decoded.uid,
      email: decoded.email,
    };
    next();
  } catch {
    res.status(401).json({ error: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً." });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractReadableError(err: unknown): { status: number; message: string } {
  const errorObj = err as { statusCode?: number; status?: number; message?: string };
  let status = errorObj?.statusCode || errorObj?.status || 500;
  let message = errorObj?.message || "Unexpected server error while calling Gemini API.";

  // @google/genai sometimes puts a JSON string inside err.message
  if (typeof message === "string" && message.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(message) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed?.error?.message) {
        message = parsed.error.message;
      }
      if (typeof parsed?.error?.code === "number") {
        status = parsed.error.code;
      }
    } catch {
      // Keep original message
    }
  }

  return { status, message };
}

function isTransientError(status: number, message: string): boolean {
  const lower = message.toLowerCase();
  return (
    status === 503 ||
    status === 429 ||
    status === 502 ||
    status === 504 ||
    lower.includes("high demand") ||
    lower.includes("unavailable") ||
    lower.includes("temporarily") ||
    lower.includes("resource_exhausted")
  );
}

async function generateWithRetry(
  ai: GoogleGenAI,
  params: {
    contents: string;
    systemInstruction: string;
    responseSchema: Record<string, unknown>;
  }
): Promise<string> {
  const attempts: { model: string; thinkingLevel: ThinkingLevel; delayMs: number }[] = [
    { model: MODEL_NAME, thinkingLevel: ThinkingLevel.MINIMAL, delayMs: 0 },
    { model: FALLBACK_MODEL_NAME, thinkingLevel: ThinkingLevel.LOW, delayMs: 300 },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      await sleep(attempt.delayMs);
    }
    try {
      const response = await ai.models.generateContent({
        model: attempt.model,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
          responseMimeType: "application/json",
          responseSchema: params.responseSchema,
        },
      });
      if (!response.text) {
        throw new Error("Model returned an empty response.");
      }
      return response.text;
    } catch (err) {
      lastError = err;
      const { status, message } = extractReadableError(err);
      if (!isTransientError(status, message)) {
        throw err;
      }
    }
  }

  throw lastError;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "GEMINI_API_KEY") {
    throw Object.assign(
      new Error(
        "مفتاح Gemini API غير مضاف. يرجى إضافته من لوحة Settings > Secrets."
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
  const { status, message: rawMessage } = extractReadableError(err);

  if (
    rawMessage.includes("API_KEY_INVALID") ||
    (status === 400 && rawMessage.toLowerCase().includes("api key"))
  ) {
    res.status(400).json({
      error: "مفتاح Gemini API غير صالح. يرجى التحقق منه في Settings > Secrets.",
    });
    return;
  }
  if (status === 403 || rawMessage.includes("PERMISSION_DENIED")) {
    res.status(403).json({
      error: "تم رفض الصلاحية من خدمة Gemini API. يرجى التحقق من المفتاح في Settings > Secrets.",
    });
    return;
  }
  if (status === 429 || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    res.status(429).json({
      error: "تم تجاوز حد الطلبات المؤقت لخدمة الذكاء الاصطناعي. يرجى الانتظار بضع ثوانٍ والمحاولة مجدداً.",
    });
    return;
  }
  if (status === 503 || rawMessage.toLowerCase().includes("high demand")) {
    res.status(503).json({
      error: "خادم الذكاء الاصطناعي يشهد ضغطاً مؤقتاً الآن. يرجى المحاولة مرة أخرى بعد لحظات.",
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

function cleanPlaceholderText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\[\s*\]/g, "")
    .replace(/\[(?:undefined|null|datum|date|ort|unbekannt|keine\s+angabe|nicht\s+angegeben)\]/gi, "")
    .replace(/\b(?:undefined|null)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeTailoredPackage(pkg: Record<string, unknown>) {
  const jobAnalysis = (pkg.jobAnalysis ?? {}) as Record<string, unknown>;
  const tailoredCv = (pkg.tailoredCv ?? {}) as Record<string, unknown>;
  const tailoredCoverLetter = (pkg.tailoredCoverLetter ?? {}) as Record<string, unknown>;

  if (jobAnalysis) {
    jobAnalysis.startDate = cleanPlaceholderText(jobAnalysis.startDate);
    jobAnalysis.duration = cleanPlaceholderText(jobAnalysis.duration);
    jobAnalysis.location = cleanPlaceholderText(jobAnalysis.location);
    jobAnalysis.recipientContact = cleanPlaceholderText(jobAnalysis.recipientContact);
    jobAnalysis.recipientAddress = cleanPlaceholderText(jobAnalysis.recipientAddress);
  }

  if (Array.isArray(tailoredCv.experience)) {
    tailoredCv.experience = tailoredCv.experience.map((item) => {
      const exp = item as Record<string, unknown>;
      return {
        ...exp,
        period: cleanPlaceholderText(exp.period),
        location: cleanPlaceholderText(exp.location),
      };
    });
  }

  if (Array.isArray(tailoredCv.education)) {
    tailoredCv.education = tailoredCv.education.map((item) => {
      const edu = item as Record<string, unknown>;
      return {
        ...edu,
        period: cleanPlaceholderText(edu.period),
        location: cleanPlaceholderText(edu.location),
        details: cleanPlaceholderText(edu.details),
      };
    });
  }

  if (tailoredCoverLetter) {
    tailoredCoverLetter.datePlaceLine = cleanPlaceholderText(tailoredCoverLetter.datePlaceLine);
    tailoredCoverLetter.senderBlock =
      typeof tailoredCoverLetter.senderBlock === "string"
        ? tailoredCoverLetter.senderBlock
            .split("\n")
            .map((line) => cleanPlaceholderText(line))
            .filter(Boolean)
            .join("\n")
        : "";
    tailoredCoverLetter.recipientBlock =
      typeof tailoredCoverLetter.recipientBlock === "string"
        ? tailoredCoverLetter.recipientBlock
            .split("\n")
            .map((line) => cleanPlaceholderText(line))
            .filter(Boolean)
            .join("\n")
        : "";
  }

  return pkg;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "6mb" }));
  app.use("/api", (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    next();
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    const hasKey = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY" &&
        process.env.GEMINI_API_KEY !== "GEMINI_API_KEY"
    );
    res.json({ ok: true, aiConfigured: hasKey });
  });

  app.post("/api/tailor", requireFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const { profile, jobDescription, targetCompany, targetRole, language, tone } = req.body ?? {};

      if (!jobDescription || typeof jobDescription !== "string" || !jobDescription.trim()) {
        res.status(400).json({ error: "يرجى لصق نص إعلان الوظيفة (Stellenanzeige) أولاً." });
        return;
      }
      if (!profile || typeof profile !== "object" || !profile.fullName) {
        res
          .status(400)
          .json({ error: "يرجى إضافة اسمك وبياناتك في صفحة ملفي الشخصي أولاً." });
        return;
      }

      const ai = getGeminiClient();

      const languageInstruction =
        language === "en"
          ? "Write both the tailored CV and cover letter in clear, professional English tailored to German company expectations. Write jobAnalysis.overview, requirementMatches[].category, requirementMatches[].evidenceFromProfile, gapsOrActionItems, tailoringNotes, and tailoredCoverLetter.englishSummary in clear, simple Arabic (العربية المبسطة) so the applicant easily understands everything."
          : "Write both the tailored CV (Lebenslauf) and cover letter (Anschreiben) in natural, idiomatic, error-free German (Sie-Anrede). IMPORTANT: Write jobAnalysis.overview, requirementMatches[].category, requirementMatches[].evidenceFromProfile, gapsOrActionItems, tailoringNotes, and tailoredCoverLetter.englishSummary in clear, friendly, simple Arabic (العربية المبسطة) so an Arabic-speaking applicant understands every detail, gap, and what the German cover letter says.";

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
6. For requirementMatches[].strength, only use one of: "strong", "transferable", or "gap". Keep requirementMatches concise (5 to 7 key requirements).
7. NO EMPTY BRACKETS OR UNDEFINED DATES: Never output literal "[]", "[...]", "[Datum]", "[Ort]", or "undefined" anywhere (especially in period, startDate, datePlaceLine, or location). If a date or location is missing or undefined, use an empty string "" or a natural phrase like "nach Vereinbarung" — never brackets.`;

      const userPrompt = `TARGET OVERRIDES (if non-empty, prioritize these):
Target Company: ${targetCompany || "(extract from job description)"}
Target Role: ${targetRole || "(extract from job description)"}

CANDIDATE MASTER PROFILE:
${JSON.stringify(sanitizeProfileForAi(profile), null, 2)}

JOB DESCRIPTION (STELLENANZEIGE):
${jobDescription}`;

      const rawText = await generateWithRetry(ai, {
        contents: userPrompt,
        systemInstruction,
        responseSchema: TAILOR_RESPONSE_SCHEMA,
      });

      const parsed = sanitizeTailoredPackage(JSON.parse(rawText) as Record<string, unknown>);
      res.json(parsed);
    } catch (err) {
      handleGeminiError(err, res);
    }
  });

  app.post("/api/refine", requireFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const { profile, jobDescription, currentPackage, targetSection, instruction, language } =
        req.body ?? {};

      if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
        res.status(400).json({ error: "يرجى كتابة التعديل المطلوب." });
        return;
      }
      if (!currentPackage) {
        res.status(400).json({ error: "لا توجد مستندات معدلة لتحديثها." });
        return;
      }

      const ai = getGeminiClient();

      const systemInstruction = `You are refining an existing tailored German Ausbildung application package (Lebenslauf and/or DIN 5008 Anschreiben).
Follow the user's refinement instruction precisely (even if the instruction is written in Arabic) while strictly preserving truthfulness against the Candidate Profile (never invent fake experience or qualifications).
Keep the CV and Cover Letter in German (or English if language === "en"), and keep jobAnalysis.overview, gapsOrActionItems, tailoringNotes, and tailoredCoverLetter.englishSummary in clear, simple Arabic.
Never output literal "[]", "[...]", or "undefined" if any date or field is missing — use empty string "" instead.
Target section to focus on: ${targetSection || "both"}.
Output language mode: ${language || "de_with_notes"}.
Return the complete updated JSON object matching the schema.`;

      const rawText = await generateWithRetry(ai, {
        contents: `REFINEMENT INSTRUCTION:
${instruction}

CANDIDATE PROFILE:
${JSON.stringify(profile ? sanitizeProfileForAi(profile) : {}, null, 2)}

JOB DESCRIPTION:
${jobDescription}

CURRENT TAILORED PACKAGE:
${JSON.stringify(currentPackage, null, 2)}`,
        systemInstruction,
        responseSchema: TAILOR_RESPONSE_SCHEMA,
      });

      res.json(sanitizeTailoredPackage(JSON.parse(rawText) as Record<string, unknown>));
    } catch (err) {
      handleGeminiError(err, res);
    }
  });

  app.post("/api/parse-cv", requireFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const { rawText } = req.body ?? {};
      if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
        res.status(400).json({ error: "يرجى لصق نص السيرة الذاتية للاستخراج." });
        return;
      }

      const ai = getGeminiClient();

      const parsedText = await generateWithRetry(ai, {
        contents: `Extract structured candidate profile fields from the following CV/resume text. Leave unknown fields as empty string "" or empty arrays []. Do not invent missing information.\n\nCV TEXT:\n${rawText}`,
        systemInstruction:
          "You accurately extract structured candidate profile information from raw CV or resume text in German or English without inventing any facts.",
        responseSchema: PARSE_CV_SCHEMA,
      });

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

async function startLocalServer() {
  const port = Number(process.env.PORT) || 3000;

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

if (!process.env.VERCEL) {
  startLocalServer();
}

export default app;
