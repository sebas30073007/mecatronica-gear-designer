const STEP_API = (import.meta.env.VITE_STEP_API_URL as string | undefined)?.replace(/\/$/, '');

export interface SpurStepRequest {
  teeth: number;
  module_mm: number;
  pressure_angle_deg: number;
  thickness_mm: number;
  bore_mm: number | null;
  bore_type: 'd-shaft' | 'keyway' | 'round' | 'none';
  label: string;
}

async function stepFetch(endpoint: string, body: unknown, filename: string): Promise<void> {
  if (!STEP_API) throw new Error('STEP export requires VITE_STEP_API_URL — add it to .env.local');
  const res = await fetch(`${STEP_API}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { const b = await res.json(); if (b?.detail) detail = b.detail; } catch (_) {/* */}
    throw new Error(`STEP export failed (${res.status}): ${detail}`);
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportSpurGearStep(req: SpurStepRequest): Promise<void> {
  await stepFetch(
    '/step-export/spur',
    req,
    `gear-${req.label}-${req.teeth}T-M${req.module_mm}.step`,
  );
}

export interface RingGearStepRequest {
  ring_teeth: number;
  module_mm: number;
  pressure_angle_deg: number;
  thickness_mm: number;
  wall_thickness_mm: number;
  label: string;
}

export async function exportRingGearStep(req: RingGearStepRequest): Promise<void> {
  await stepFetch(
    '/step-export/ring-gear',
    req,
    `gear-${req.label}-${req.ring_teeth}T-M${req.module_mm}.step`,
  );
}

export interface RackStepRequest {
  n_teeth: number;
  module_mm: number;
  pressure_angle_deg: number;
  thickness_mm: number;
  label: string;
}

export async function exportRackStep(req: RackStepRequest): Promise<void> {
  await stepFetch(
    '/step-export/rack',
    req,
    `rack-${req.label}-${req.n_teeth}T-M${req.module_mm}.step`,
  );
}

export interface BevelStepRequest {
  teeth:              number;
  partner_teeth:      number;
  module_mm:          number;
  pressure_angle_deg: number;
  face_width_mm:      number;
  bore_mm:            number | null;
  label:              string;
}

export async function exportBevelGearStep(req: BevelStepRequest): Promise<void> {
  await stepFetch(
    '/step-export/bevel',
    req,
    `bevel-${req.label}-${req.teeth}T-M${req.module_mm}.step`,
  );
}
