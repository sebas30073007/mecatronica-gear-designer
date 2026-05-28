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

export async function exportSpurGearStep(req: SpurStepRequest): Promise<void> {
  if (!STEP_API) {
    throw new Error('STEP export requires VITE_STEP_API_URL — add it to .env.local');
  }

  const res = await fetch(`${STEP_API}/step-export/spur`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try { const b = await res.json(); if (b?.detail) detail = b.detail; } catch (_) {/* */}
    throw new Error(`STEP export failed (${res.status}): ${detail}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gear-${req.label}-${req.teeth}T-M${req.module_mm}.step`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
