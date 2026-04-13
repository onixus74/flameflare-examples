import wasm from './add.wasm';

export default {
  async fetch(request) {
    const instance = await WebAssembly.instantiate(wasm);
    const { add } = instance.exports;

    const url = new URL(request.url);
    const a = parseInt(url.searchParams.get('a') || '1', 10);
    const b = parseInt(url.searchParams.get('b') || '2', 10);
    const result = add(a, b);

    return Response.json({
      operation: 'add',
      inputs: { a, b },
      result,
      source: 'WebAssembly',
    });
  },
};