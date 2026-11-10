// PROTOTYPE, throwaway. Generates one Imagen 4 Fast image per recipe name,
// sends it to the matting server, saves raw + finished art to an output dir.
//
//   node scripts/prototype-recipe-art/client.mjs <out-dir> "Name" "Name" ...

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [out, ...names] = process.argv.slice(2);
const env = await readFile("apps/api/.env", "utf8");
const key = env.match(/^GOOGLE_GENERATIVE_AI_API_KEY=(.*)$/m)?.[1]?.trim();
if (!key) throw new Error("No GOOGLE_GENERATIVE_AI_API_KEY in apps/api/.env");
await mkdir(out, { recursive: true });

const MODEL = "gemini-3.1-flash-lite-image";

// The README's sheet formula, cut down to one dish.
const prompt = (name) =>
  `A single small claymation meal composition, centered, with 15% clear margin on every side, front three-quarter view. The dish: ${name}. Bold simple silhouette, recognisable as a small thumbnail.

Handcrafted stop-motion claymation art style, soft matte modeling clay with rounded edges, pillowy volume, cute tactile feel. Non-reflective, unglazed matte surface with zero specular highlights or shine. Sauces, egg whites, and toppings are sculpted from solid opaque clay, no wet or oily sheen. Soft diffused ambient lighting with gentle shadows. Solid flat uniform neutral mid-grey background, exact colour #808080, plain and seamless, no ground plane, no cast shadows on the background. No blue tones in any subject. No text, words, labels, lettering, brand marks, flags, borders, checkmarks, sparkles, or mascot.`;

for (const name of names) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  let t = performance.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt(name) }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "1:1" },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const b64 = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
    ?.inlineData.data;
  console.log(name, "usage", JSON.stringify(json.usageMetadata));
  if (!b64) throw new Error(`No image for ${name} (filtered?)`);
  const raw = Buffer.from(b64, "base64");
  const genSeconds = (performance.now() - t) / 1000;
  await writeFile(join(out, `${slug}.raw.png`), raw);

  t = performance.now();
  const matte = await fetch("http://127.0.0.1:8765/matte", {
    method: "POST",
    body: raw,
  });
  const art = Buffer.from(await matte.arrayBuffer());
  await writeFile(join(out, `${slug}.webp`), art);
  console.log(
    `${name}: generate ${genSeconds.toFixed(1)}s, matte round trip ${((performance.now() - t) / 1000).toFixed(1)}s | ${matte.headers.get("x-stats")}`,
  );
}
