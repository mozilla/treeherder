export default async function unGzip(blob) {
  const decompressionStream = new DecompressionStream('gzip');
  const decompressedStream = blob.stream().pipeThrough(decompressionStream);
  const payloadText = await (
    await new Response(decompressedStream).blob()
  ).text();
  return JSON.parse(payloadText);
}
