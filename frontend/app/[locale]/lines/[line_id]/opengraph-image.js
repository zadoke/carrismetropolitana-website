import fs from 'fs';
import { ImageResponse } from 'next/server';
import OpenGraphLinesDefault from 'opengraph/OpenGraphLinesDefault';
import OpenGraphLinesDynamic from 'opengraph/OpenGraphLinesDynamic';

/* * */

export const alt = 'Mais sobre esta linha';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/* * */

export default async function Image({ params }) {
  //

  //
  // A. Setup fonts

  const customFonts = [
    { name: 'Inter', style: 'normal', weight: 500, data: fs.readFileSync(`${process.cwd()}/assets/fonts/Inter-Medium.ttf`).buffer },
    { name: 'Inter', style: 'normal', weight: 600, data: fs.readFileSync(`${process.cwd()}/assets/fonts/Inter-SemiBold.ttf`).buffer },
    { name: 'Inter', style: 'normal', weight: 700, data: fs.readFileSync(`${process.cwd()}/assets/fonts/Inter-Bold.ttf`).buffer },
  ];

  //
  // B. Fetch data

  const lineData = await fetch(params.line_id?.length && `https://api.carrismetropolitana.pt/stops/${params.line_id}`).then((res) => res.json());

  //
  // C. Render default component

  if (params.line_id === 'all' || !lineData?.id) {
    return new ImageResponse(<OpenGraphLinesDefault />, { ...size, fonts: customFonts });
  }

  // - - -

  //
  // D. Fetch additional data

  const allLinesData = [];

  for (const lineId of lineData.lines) {
    const lineData = await fetch(`https://api.carrismetropolitana.pt/lines/${lineId}`).then((res) => res.json());
    allLinesData.push(lineData);
  }

  //
  // E. Render dynamic component

  return new ImageResponse(<OpenGraphLinesDynamic lineData={lineData} allLinesData={allLinesData} />, { ...size, fonts: customFonts });

  //
}
