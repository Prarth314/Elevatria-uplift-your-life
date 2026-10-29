const colorPattern=/^(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([0-9.%+/,\s-]+\)|var\(--[A-Za-z0-9_-]+\))$/;
export function chartCss(id:string,config:Record<string,{color?:unknown;theme?:{light?:unknown;dark?:unknown}}>):string {
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))return '';
  return (['light','dark'] as const).map(theme=>{
    const declarations=Object.entries(config).flatMap(([name,item])=>{
      if(!/^[A-Za-z0-9_-]{1,64}$/.test(name))return [];
      const color=item.theme?.[theme]??item.color;
      return typeof color==='string'&&color.length<=128&&colorPattern.test(color)?[`--color-${name}: ${color};`]:[];
    });
    return `${theme==='dark'?'.dark ':''}[data-chart="${id}"] {${declarations.join('\n')}}`;
  }).join('\n');
}
