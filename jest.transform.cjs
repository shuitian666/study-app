const ts = require('typescript');

module.exports = {
  process(sourceText, sourcePath) {
    const result = ts.transpileModule(sourceText, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        isolatedModules: true,
      },
      fileName: sourcePath,
    });

    return { code: result.outputText };
  },
};
