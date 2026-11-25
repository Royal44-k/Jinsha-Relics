// Catch ordinary long frames up in the fixed-step simulation. Only a suspension
// sized gap is bounded, rather than silently slowing travel below 25 FPS.
export function simulationDelta(raw){
 return Number.isFinite(raw)?Math.max(0,Math.min(.25,raw)):0;
}

// Closed-form constant acceleration keeps a short dust/splash flight independent
// of the display cadence, including an occasional 120ms frame.
export function advanceParticle(position,velocity,gravity,dt){
 position.x+=velocity.x*dt;position.y+=velocity.y*dt+.5*gravity*dt*dt;position.z+=velocity.z*dt;
 velocity.y+=gravity*dt;
}
