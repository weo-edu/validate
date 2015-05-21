var tape = require('tape')
var cosmic = require('./fixtures/cosmic')
var validator = require('../')

tape('simple', function(t) {
  var schema = {
    required: true,
    type: 'object',
    properties: {
      hello: {type:'string', required:true}
    }
  }

  var validate = validator(schema)

  t.ok(validate({hello: 'world'}).valid, 'should be valid')
  t.notOk(validate().valid, 'should be invalid')
  t.notOk(validate({}).valid, 'should be invalid')
  t.end()
})

tape('advanced', function(t) {
  var validate = validator(cosmic.schema)

  t.ok(validate(cosmic.valid).valid, 'should be valid')
  t.notOk(validate(cosmic.invalid).valid, 'should be invalid')
  t.end()
})

tape('greedy/false', function(t) {
  var validate = validator({
    type: 'object',
    properties: {
      x: {
        type: 'number'
      }
    },
    required: ['x', 'y']
  });
  t.notOk(validate({}).valid, 'should be invalid')
  t.strictEqual(validate.errors.length, 2);
  t.strictEqual(validate.errors[0].field, 'x')
  t.strictEqual(validate.errors[0].message, 'is required')
  t.strictEqual(validate.errors[1].field, 'y')
  t.strictEqual(validate.errors[1].message, 'is required')
  t.notOk(validate({x: 'string'}).valid, 'should be invalid')
  t.strictEqual(validate.errors.length, 1);
  t.strictEqual(validate.errors[0].field, 'y')
  t.strictEqual(validate.errors[0].message, 'is required')
  t.notOk(validate({x: 'string', y: 'value'}).valid, 'should be invalid')
  t.strictEqual(validate.errors.length, 1);
  t.strictEqual(validate.errors[0].field, 'x')
  t.strictEqual(validate.errors[0].message, 'is the wrong type')
  t.end();
});

tape('greedy/true', function(t) {
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
  t.notOk(validate({}).valid, 'should be invalid')
  t.strictEqual(validate.errors.length, 2);
  t.strictEqual(validate.errors[0].field, 'x')
  t.strictEqual(validate.errors[0].message, 'is required')
  t.strictEqual(validate.errors[1].field, 'y')
  t.strictEqual(validate.errors[1].message, 'is required')
  t.notOk(validate({x: 'string'}).valid, 'should be invalid')
  t.strictEqual(validate.errors.length, 2);
  t.strictEqual(validate.errors[0].field, 'y')
  t.strictEqual(validate.errors[0].message, 'is required')
  t.strictEqual(validate.errors[1].field, 'x')
  t.strictEqual(validate.errors[1].message, 'is the wrong type')
  t.notOk(validate({x: 'string', y: 'value'}).valid, 'should be invalid')
  t.strictEqual(validate.errors.length, 1);
  t.strictEqual(validate.errors[0].field, 'x')
  t.strictEqual(validate.errors[0].message, 'is the wrong type')
  t.ok(validate({x: 1, y: 'value'}).valid, 'should be invalid')
  t.end();
});

tape('additional props', function(t) {
  var validate = validator({
    type: 'object',
    additionalProperties: false
  }, {
    verbose: true
  })

  t.ok(validate({}).valid)
  t.notOk(validate({foo:'bar'}).valid)
  t.ok(validate.errors[0].value === 'foo', 'should output the property not allowed in verbose mode')
  t.end()
})

tape('array', function(t) {
  var validate = validator({
    type: 'array',
    required: true,
    items: {
      type: 'string'
    }
  })

  t.notOk(validate({}).valid, 'wrong type')
  t.notOk(validate().valid, 'is required')
  t.ok(validate(['test']).valid)
  t.end()
})

tape('nested array', function(t) {
  var validate = validator({
    type: 'object',
    properties: {
      list: {
        type: 'array',
        required: true,
        items: {
          type: 'string'
        }
      }
    }
  })

  t.notOk(validate({}).valid, 'is required')
  t.ok(validate({list:['test']}).valid)
  t.notOk(validate({list:[1]}).valid)
  t.end()
})

tape('enum', function(t) {
  var validate = validator({
    type: 'object',
    properties: {
      foo: {
        type: 'number',
        required: true,
        enum: [42]
      }
    }
  })

  t.notOk(validate({}).valid, 'is required')
  t.ok(validate({foo:42}).valid)
  t.notOk(validate({foo:43}).valid)
  t.end()
})

tape('minimum/maximum', function(t) {
  var validate = validator({
    type: 'object',
    properties: {
      foo: {
        type: 'number',
        minimum: 0,
        maximum: 0
      }
    }
  })

  t.notOk(validate({foo:-42}).valid)
  t.ok(validate({foo:0}).valid)
  t.notOk(validate({foo:42}).valid)
  t.end()
})

tape('exclusiveMinimum/exclusiveMaximum', function(t) {
  var validate = validator({
    type: 'object',
    properties: {
      foo: {
        type: 'number',
        minimum: 10,
        maximum: 20,
        exclusiveMinimum: true,
        exclusiveMaximum: true
      }
    }
  })

  t.notOk(validate({foo:10}).valid)
  t.ok(validate({foo:11}).valid)
  t.notOk(validate({foo:20}).valid)
  t.ok(validate({foo:19}).valid)
  t.end()
})

tape('custom format', function(t) {
  var validate = validator({
    type: 'object',
    properties: {
      foo: {
        type: 'string',
        format: 'as'
      }
    }
  }, {formats: {as:/^a+$/}})

  t.notOk(validate({foo:''}).valid, 'not as')
  t.notOk(validate({foo:'b'}).valid, 'not as')
  t.notOk(validate({foo:'aaab'}).valid, 'not as')
  t.ok(validate({foo:'a'}).valid, 'as')
  t.ok(validate({foo:'aaaaaa'}).valid, 'as')
  t.end()
})

tape('custom format function', function(t) {
  var validate = validator({
    type: 'object',
    properties: {
      foo: {
        type: 'string',
        format: 'as'
      }
    }
  }, {formats: {as:function(s) { return /^a+$/.test(s) } }})

  t.notOk(validate({foo:''}).valid, 'not as')
  t.notOk(validate({foo:'b'}).valid, 'not as')
  t.notOk(validate({foo:'aaab'}).valid, 'not as')
  t.ok(validate({foo:'a'}).valid, 'as')
  t.ok(validate({foo:'aaaaaa'}).valid, 'as')
  t.end()
})

tape('do not mutate schema', function(t) {
  var sch = {
    items: [
      {}
    ],
    additionalItems: {
      type: 'integer'
    }
  }

  var copy = JSON.parse(JSON.stringify(sch))

  validator(sch)

  t.same(sch, copy, 'did not mutate')
  t.end()
})

tape('#toJSON()', function(t) {
  var schema = {
    required: true,
    type: 'object',
    properties: {
      hello: {type:'string', required:true}
    }
  }

  var validate = validator(schema)

  t.deepEqual(validate.toJSON(), schema, 'should return original schema')
  t.end()
})

tape('external schemas', function(t) {
  var ext = {type: 'string'}
  var schema = {
    required: true,
    $ref: '#ext'
  }

  var validate = validator(schema, {schemas: {ext:ext}})

  t.ok(validate('hello string').valid, 'is a string')
  t.notOk(validate(42).valid, 'not a string')
  t.end()
})

tape('top-level external schema', function(t) {
  var defs = {
    "string": {
      type: "string"
    },
    "sex": {
      type: "string",
      enum: ["male", "female", "other"]
    }
  }
  var schema = {
    type: "object",
    properties: {
      "name": { $ref: "definitions.json#/string" },
      "sex": { $ref: "definitions.json#/sex" }
    },
    required: ["name", "sex"]
  }

  var validate = validator(schema, {
    schemas: {
      "definitions.json": defs
    }
  })
  t.ok(validate({name:"alice", sex:"female"}).valid, 'is an object')
  t.notOk(validate({name:"alice", sex: "bob"}).valid, 'recognizes external schema')
  t.notOk(validate({name:2, sex: "female"}).valid, 'recognizes external schema')
  t.end()
})

tape('nested required array decl', function(t) {
  var schema = {
    properties: {
      x: {
        type: 'object',
        properties: {
          y: {
            type: 'object',
            properties: {
              z: {
                type: 'string'
              }
            },
            required: ['z']
          }
        }
      }
    },
    required: ['x']
  }

  var validate = validator(schema)

  t.ok(validate({x: {}}).valid, 'should be valid')
  t.notOk(validate({}).valid, 'should not be valid')
  t.strictEqual(validate.errors[0].field, 'x', 'should output the missing field')
  t.end()
})

tape('verbose mode', function(t) {
  var schema = {
    required: true,
    type: 'object',
    properties: {
      hello: {
        required: true,
        type: 'string'
      }
    }
  };

  var validate = validator(schema, {verbose: true})

  t.ok(validate({hello: 'string'}).valid, 'should be valid')
  t.notOk(validate({hello: 100}).valid, 'should not be valid')
  t.strictEqual(validate.errors[0].value, 100, 'error object should contain the invalid value')
  t.end()
})

tape('additional props in verbose mode', function(t) {
  var schema = {
    type: 'object',
    required: true,
    additionalProperties: false,
    properties: {
      foo: {
        type: 'string'
      },
      'hello world': {
        type: 'object',
        required: true,
        additionalProperties: false,
        properties: {
          foo: {
            type: 'string'
          }
        }
      }
    }
  };

  var validate = validator(schema, {verbose: true})

  validate({'hello world': {bar: 'string'}});

  t.strictEqual(validate.errors[0].field, '["hello world"]')
  t.strictEqual(validate.errors[0].value, '["hello world"].bar', 'should output the path to the additional prop in the error')
  t.end()
})

tape('Date.now() is an integer', function(t) {
  var schema = {type: 'integer'}
  var validate = validator(schema)

  t.ok(validate(Date.now()).valid, 'is integer')
  t.end()
})

tape('field shows item index in arrays', function(t) {
  var schema = {
    type: 'array',
    items: {
      type: 'array',
      items: {
        properties: {
          foo: {
            type: 'string',
            required: true
          }
        }
      }
    }
  }

  var validate = validator(schema)

  validate([
    [
      { foo: 'test' },
      { foo: 'test' }
    ],
    [
      { foo: 'test' },
      { baz: 'test' }
    ]
  ])

  t.strictEqual(validate.errors[0].field, '1.1.foo', 'should output the field with specific index of failing item in the error')
  t.end()
})

tape('error messages', function(t) {
  var schema = {
    type: 'object',
    properties: {
      foo: {
        type: 'string',
        required: true
      }
    }
  }

  var validate = validator(schema)

  validate({bar: 'test'})

  t.strictEqual(validate.errors[0].field, 'foo', 'should include field')
  t.strictEqual(validate.errors[0].code, 'required', 'should include code')
  t.strictEqual(validate.errors[0].message, 'is required', 'should include message')
  t.end()
})

tape('error format message', function(t) {
  var schema = {
    type: 'string',
    format: 'email'
  }

  var validate = validator(schema)

  validate('foo')

  t.strictEqual(validate.errors[0].field, '', 'should include field')
  t.strictEqual(validate.errors[0].code, 'format', 'should include code')
  t.strictEqual(validate.errors[0].message, 'must be email format', 'should include message')
  t.end()
})

tape('customizable error messages', function(t) {
  var schema = {
    type: 'object',
    properties: {
      foo: {
        type: 'string',
        required: true,
        messages: {
          required: 'requires foo'
        }
      }
    }
  }

  var validate = validator(schema)

  validate({bar: 'test'})

  t.strictEqual(validate.errors[0].field, 'foo', 'should include field')
  t.strictEqual(validate.errors[0].code, 'required', 'should include code')
  t.strictEqual(validate.errors[0].message, 'requires foo', 'should use custom')
  t.end()
})


