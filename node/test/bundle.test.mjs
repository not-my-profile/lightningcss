import path from 'path';
import fs from 'fs';
import { bundleAsync } from '../index.mjs';
import { test } from 'uvu';
import * as assert from 'uvu/assert';

test('resolver', async () => {
  const inMemoryFs = new Map(Object.entries({
    'foo.css': `
 @import 'root:bar.css';

 .foo { color: red; }
         `.trim(),

    'bar.css': `
 @import 'root:hello/world.css';

 .bar { color: green; }
         `.trim(),

    'hello/world.css': `
 .baz { color: blue; }
         `.trim(),
  }));

  const { code: buffer } = await bundleAsync({
    filename: 'foo.css',
    resolver: {
      read(file) {
        const result = inMemoryFs.get(path.normalize(file));
        if (!result) throw new Error(`Could not find ${file} in ${Array.from(inMemoryFs.keys()).join(', ')}.`);
        return result;
      },

      resolve(specifier) {
        return specifier.slice('root:'.length);
      },
    },
  });
  const code = buffer.toString('utf-8').trim();

  const expected = `
.baz {
  color: #00f;
}

.bar {
  color: green;
}

.foo {
  color: red;
}
     `.trim();
  if (code !== expected) throw new Error(`\`testResolver()\` failed. Expected:\n${expected}\n\nGot:\n${code}`);
});

test('only custom read', async () => {
  const inMemoryFs = new Map(Object.entries({
    'foo.css': `
 @import 'hello/world.css';

 .foo { color: red; }
         `.trim(),

    'hello/world.css': `
 @import '../bar.css';

 .bar { color: green; }
         `.trim(),

    'bar.css': `
 .baz { color: blue; }
         `.trim(),
  }));

  const { code: buffer } = await bundleAsync({
    filename: 'foo.css',
    resolver: {
      read(file) {
        const result = inMemoryFs.get(path.normalize(file));
        if (!result) throw new Error(`Could not find ${file} in ${Array.from(inMemoryFs.keys()).join(', ')}.`);
        return result;
      },
    },
  });
  const code = buffer.toString('utf-8').trim();

  const expected = `
.baz {
  color: #00f;
}

.bar {
  color: green;
}

.foo {
  color: red;
}
     `.trim();
  if (code !== expected) throw new Error(`\`testOnlyCustomRead()\` failed. Expected:\n${expected}\n\nGot:\n${code}`);
});

test('only custom resolve', async () => {
  const root = path.join('tests', 'testdata');
  const { code: buffer } = await bundleAsync({
    filename: path.join(root, 'foo.css'),
    resolver: {
      resolve(specifier) {
        // Strip `root:` prefix off specifier and resolve it as an absolute path
        // in the test data root.
        return path.join(root, specifier.slice('root:'.length));
      },
    },
  });
  const code = buffer.toString('utf-8').trim();

  const expected = `
.baz {
  color: #00f;
}

.bar {
  color: green;
}

.foo {
  color: red;
}
     `.trim();
  if (code !== expected) throw new Error(`\`testOnlyCustomResolve()\` failed. Expected:\n${expected}\n\nGot:\n${code}`);
});

test('async read', async () => {
  const root = path.join('tests', 'testdata');
  const { code: buffer } = await bundleAsync({
    filename: path.join(root, 'foo.css'),
    resolver: {
      async read(file) {
        return await fs.promises.readFile(file, 'utf8');
      },
      resolve(specifier) {
        // Strip `root:` prefix off specifier and resolve it as an absolute path
        // in the test data root.
        return path.join(root, specifier.slice('root:'.length));
      },
    },
  });
  const code = buffer.toString('utf-8').trim();

  const expected = `
.baz {
  color: #00f;
}

.bar {
  color: green;
}

.foo {
  color: red;
}
     `.trim();
  if (code !== expected) throw new Error(`\`testAsyncRead()\` failed. Expected:\n${expected}\n\nGot:\n${code}`);
});

test('read throw', async () => {
  let error = undefined;
  try {
    await bundleAsync({
      filename: 'foo.css',
      resolver: {
        read(file) {
          throw new Error(`Oh noes! Failed to read \`${file}\`.`);
        }
      },
    });
  } catch (err) {
    error = err;
  }

  if (!error) throw new Error(`\`testReadThrow()\` failed. Expected \`bundleAsync()\` to throw, but it did not.`);
  assert.equal(error.message, `Oh noes! Failed to read \`foo.css\`.`);
  assert.equal(error.loc, undefined); // error occurred when reading initial file, no location info available.
});

test('async read throw', async () => {
  let error = undefined;
  try {
    await bundleAsync({
      filename: 'foo.css',
      resolver: {
        async read(file) {
          throw new Error(`Oh noes! Failed to read \`${file}\`.`);
        }
      },
    });
  } catch (err) {
    error = err;
  }

  if (!error) throw new Error(`\`testReadThrow()\` failed. Expected \`bundleAsync()\` to throw, but it did not.`);
  assert.equal(error.message, `Oh noes! Failed to read \`foo.css\`.`);
  assert.equal(error.loc, undefined); // error occurred when reading initial file, no location info available.
});

test('read throw with location info', async () => {
  let error = undefined;
  try {
    await bundleAsync({
      filename: 'foo.css',
      resolver: {
        read(file) {
          if (file === 'foo.css') {
            return '@import "bar.css"';
          }
          throw new Error(`Oh noes! Failed to read \`${file}\`.`);
        }
      },
    });
  } catch (err) {
    error = err;
  }

  if (!error) throw new Error(`\`testReadThrow()\` failed. Expected \`bundleAsync()\` to throw, but it did not.`);
  assert.equal(error.message, `Oh noes! Failed to read \`bar.css\`.`);
  assert.equal(error.fileName, 'foo.css');
  assert.equal(error.loc, {
    line: 1,
    column: 1
  });
});

test('async read throw with location info', async () => {
  let error = undefined;
  try {
    await bundleAsync({
      filename: 'foo.css',
      resolver: {
        async read(file) {
          if (file === 'foo.css') {
            return '@import "bar.css"';
          }
          throw new Error(`Oh noes! Failed to read \`${file}\`.`);
        }
      },
    });
  } catch (err) {
    error = err;
  }

  if (!error) throw new Error(`\`testReadThrow()\` failed. Expected \`bundleAsync()\` to throw, but it did not.`);
  assert.equal(error.message, `Oh noes! Failed to read \`bar.css\`.`);
  assert.equal(error.fileName, 'foo.css');
  assert.equal(error.loc, {
    line: 1,
    column: 1
  });
});

test('resolve throw', async () => {
  let error = undefined;
  try {
    await bundleAsync({
      filename: 'tests/testdata/foo.css',
      resolver: {
        resolve(specifier, originatingFile) {
          throw new Error(`Oh noes! Failed to resolve \`${specifier}\` from \`${originatingFile}\`.`);
        }
      },
    });
  } catch (err) {
    error = err;
  }

  if (!error) throw new Error(`\`testResolveThrow()\` failed. Expected \`bundleAsync()\` to throw, but it did not.`);
  assert.equal(error.message, `Oh noes! Failed to resolve \`root:hello/world.css\` from \`tests/testdata/foo.css\`.`);
  assert.equal(error.fileName, 'tests/testdata/foo.css');
  assert.equal(error.loc, {
    line: 1,
    column: 1
  });
});

test('async resolve throw', async () => {
  let error = undefined;
  try {
    await bundleAsync({
      filename: 'tests/testdata/foo.css',
      resolver: {
        async resolve(specifier, originatingFile) {
          throw new Error(`Oh noes! Failed to resolve \`${specifier}\` from \`${originatingFile}\`.`);
        }
      },
    });
  } catch (err) {
    error = err;
  }

  if (!error) throw new Error(`\`testResolveThrow()\` failed. Expected \`bundleAsync()\` to throw, but it did not.`);
  assert.equal(error.message, `Oh noes! Failed to resolve \`root:hello/world.css\` from \`tests/testdata/foo.css\`.`);
  assert.equal(error.fileName, 'tests/testdata/foo.css');
  assert.equal(error.loc, {
    line: 1,
    column: 1
  });
});

test('read return non-string', async () => {
  let error = undefined;
  try {
    await bundleAsync({
      filename: 'foo.css',
      resolver: {
        read() {
          return 1234; // Returns a non-string value.
        }
      },
    });
  } catch (err) {
    error = err;
  }

  if (!error) throw new Error(`\`testReadReturnNonString()\` failed. Expected \`bundleAsync()\` to throw, but it did not.`);
  assert.equal(error.message, 'expect String, got: Number');
});

test('resolve return non-string', async () => {
  let error = undefined;
  try {
    await bundleAsync({
      filename: 'tests/testdata/foo.css',
      resolver: {
        resolve() {
          return 1234; // Returns a non-string value.
        }
      },
    });
  } catch (err) {
    error = err;
  }

  if (!error) throw new Error(`\`testResolveReturnNonString()\` failed. Expected \`bundleAsync()\` to throw, but it did not.`);
  assert.equal(error.message, 'expect String, got: Number');
  assert.equal(error.fileName, 'tests/testdata/foo.css');
  assert.equal(error.loc, {
    line: 1,
    column: 1
  });
});

test('should throw with location info on syntax errors', async () => {
  let error = undefined;
  try {
    await bundleAsync({
      filename: 'tests/testdata/foo.css',
      resolver: {
        read() {
          return '.foo'
        }
      },
    });
  } catch (err) {
    error = err;
  }

  assert.equal(error.message, `Unexpected end of input`);
  assert.equal(error.fileName, 'tests/testdata/foo.css');
  assert.equal(error.loc, {
    line: 1,
    column: 5
  });
});

test.run();
