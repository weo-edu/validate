[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)
[ ![Codeship Status for weo-edu/validate](https://codeship.com/projects/c3283030-dff3-0132-e34e-4a4681aa8cab/status?branch=master)](https://codeship.com/projects/80692) 

# Validate

A [JSONSchema](http://json-schema.org/) validator that uses code generation
to be extremely fast

```
npm install @weo-edu/validate
```

It passes the entire JSONSchema v4 test suite except for `remoteRefs` and `maxLength`/`minLength` when using unicode surrogate pairs.


## Usage

Simply pass a schema to compile it

``` js
var validator = require('is-my-json-valid')

var validate = validator({
  required: true,
  type: 'object',
  properties: {
    hello: {
      required: true,
      type: 'string'
    }
  }
})

console.log('should be valid', validate({hello: 'world'}))
console.log('should not be valid', validate({}))

// get the last list of errors by checking validate.errors
// the following will print [{field: 'data.hello', message: 'is required'}]
console.log(validate.errors)
```

You can also pass the schema as a string

``` js
var validate = validate('{"type": ... }')
```

Optionally you can use the require submodule to load a schema from `__dirname`

``` js
var validator = require('is-my-json-valid/require')
var validate = validator('my-schema.json')
```

## Custom formats

is-my-json-valid supports the formats specified in JSON schema v4 (such as date-time).
If you want to add your own custom formats pass them as the formats options to the validator

``` js
var validate = validator({
  type: 'string',
  required: true,
  format: 'only-a'
}, {
  formats: {
    'only-a': /^a+$/
  }
})

console.log(validate('aa').valid) // true
console.log(validate('ab').valid) // false
```

## External schemas

You can pass in external schemas that you reference using the `$ref` attribute as the `schemas` option

``` js
var ext = {
  required: true,
  type: 'string'
}

var schema = {
  $ref: '#ext' // references another schema called ext
}

// pass the external schemas as an option
var validate = validate(schema, {schemas: {ext: ext}})

validate('hello').valid // returns true
validate(42).valid // return false
```

## Filtering away additional properties

is-my-json-valid supports filtering away properties not in the schema

``` js
var filter = validator.filter({
  required: true,
  type: 'object',
  properties: {
    hello: {type: 'string', required: true}
  },
  additionalProperties: false
})

var doc = {hello: 'world', notInSchema: true}
console.log(filter(doc)) // {hello: 'world'}
```

## Verbose mode outputs the value on errors

is-my-json-valid outputs the value causing an error when verbose is set to true

``` js
var validate = validator({
  required: true,
  type: 'object',
  properties: {
    hello: {
      required: true,
      type: 'string'
    }
  }
}, {
  verbose: true
})

validate({hello: 100}).errors
// {field: 'data.hello', message: 'is the wrong type', value: 100, code: 'type'}
```

## Greedy mode tries to validate as much as possible

By default is-my-json-valid bails on first validation error but when greedy is
set to true it tries to validate as much as possible:

``` js
var validate = validator({
  type: 'object',
  properties: {
    x: {
      type: 'number'
    }
  },
  required: ['x', 'y']
}, {
  greedy: true
});

validate({x: 'string'}).errors;
// [{field: 'data.y', message: 'is required', code: 'required'},
//  {field: 'data.x', message: 'is the wrong type', code: 'type'}]
```

## Performance

is-my-json-valid uses code generation to turn your JSON schema into basic javascript code that is easily optimizeable by v8.

At the time of writing, is-my-json-valid is the __fastest validator__ when running

* [json-schema-benchmark](https://github.com/Muscula/json-schema-benchmark)
* [cosmicreals.com benchmark](http://cosmicrealms.com/blog/2014/08/29/benchmark-of-node-dot-js-json-validation-modules-part-3/)
* [jsck benchmark](https://github.com/pandastrike/jsck/issues/72#issuecomment-70992684)
* [themis benchmark](https://cdn.rawgit.com/playlyfe/themis/master/benchmark/results.html)
* [z-schema benchmark](https://rawgit.com/zaggino/z-schema/master/benchmark/results.html)

If you know any other relevant benchmarks open a PR and I'll add them.

## License

MIT
