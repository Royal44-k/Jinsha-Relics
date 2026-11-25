export const width = 900, height = 400;
export const witnesses = [224, 648];
export const joint = x => 221 + .054*(x-430) + 12*Math.sin(x*.008) + 5*Math.sin(x*.025);
export const top = x => 42 + Math.sin(x*.008)*12 + Math.sin(x*.03)*3;
export const radius = 48;
