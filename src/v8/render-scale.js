// Measured separately from mesh, material, light and reflection quality.
export const RENDER_PIXEL_BUDGET=2_073_600;

/** Static resize policy. This never changes scale in response to individual frames. */
export function renderPixelRatio({width=1,height=1,dpr=1,quality='high',mode='balanced'}={}){
 const finitePositive=(value,fallback)=>Number.isFinite(value)&&value>0?value:fallback;
 const native=Math.min(finitePositive(dpr,1),quality==='low'?1:1.5);
 if(mode==='detail')return native;
 const pixels=finitePositive(width,1)*finitePositive(height,1);
 // The .5 floor is a legibility limit, so extreme (>4K) windows can exceed the
 // budget. Applying the native cap last never upscales a device below DPR .5.
 return Math.min(native,Math.max(.5,Math.sqrt(RENDER_PIXEL_BUDGET/pixels)));
}
