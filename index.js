var genobj = require('generate-object-property')
var genfun = require('generate-function')
var jsonpointer = require('jsonpointer')
var xtend = require('xtend')
var formats = require('./formats')
var errors = require('./errors')

var get = function (obj, additionalSchemas, ptr) {
  if (/^https?:\/\//.test(ptr)) return null
  if (obj.toJSON) obj = obj.toJSON()
  
  var visit = function (sub) {
    if (sub && sub.id === ptr) return sub
    if (typeof sub !== 'object' || !sub) return null
    return Object.keys(sub).reduce(function (res, k) {
      return res || visit(sub[k])
    }, null)
  }

  var res = visit(obj)
  if (res) return res

  ptr = ptr.replace(/^#/, '')
  ptr = ptr.replace(/\/$/, '')

  try {
    return jsonpointer.get(obj, decodeURI(ptr))
  } catch (err) {
    var end = ptr.indexOf('#')
    var other
    // external reference
    if (end !== 0) {
      // fragment doesn't exist.
      if (end === -1) {
        other = additionalSchemas[ptr]
      } else {
        var ext = ptr.slice(0, end)
        other = additionalSchemas[ext]
        var fragment = ptr.slice(end).replace(/^#/, '')
        try {
          return jsonpointer.get(other, fragment)
        } catch (err) {}
      }
    } else {
      other = additionalSchemas[ptr]
    }
    return other || null
  }
}

var formatName = function (field) {
  field = stripData(field)
  field = JSON.stringify(field)
  var pattern = /\[([^\[\]"]+)\]/
  field = field.replace(/^\"\[([^\[\]"]+)\]/, '""+$1+"')
  while (pattern.test(field)) field = field.replace(pattern, '."+$1+"')
  return field
}

var stripData = function (field) {
  field = field.slice('data'.length)
  if (field[0] === '.') {
    field = field.slice(1)
  }
  return field
}

var types = {}

types.any = function () {
  return 'true'
}

types.null = function (name) {
  return name + ' === null'
}

types.boolean = function (name) {
  return 'typeof ' + name + ' === "boolean"'
}

types.array = function (name) {
  return 'Array.isArray(' + name + ')'
}

types.object = function (name) {
  return 'typeof ' + name + ' === "object" && ' + name + ' && !Array.isArray(' + name + ')'
}

types.number = function (name) {
  return 'typeof ' + name + ' === "number"'
}

types.integer = function (name) {
  return 'typeof ' + name + ' === "number" && (Math.floor(' + name + ') === ' + name + ' || ' + name + ' > 9007199254740992 || ' + name + ' < -9007199254740992)'
}

types.string = function (name) {
  return 'typeof ' + name + ' === "string"'
}

var unique = function (array) {
  var list = []
  for (var i = 0; i < array.length; i++) {
    list.push(typeof array[i] === 'object' ? JSON.stringify(array[i]) : array[i])
  }
  for (var j = 1; j < list.length; j++) {
    if (list.indexOf(list[j]) !== j) return false
  }
  return true
}

var compile = function (schema, cache, root, reporter, opts) {
  var fmts = opts ? xtend(formats, opts.formats) : formats
  var scope = { unique: unique, formats: fmts}
  var verbose = opts ? !!opts.verbose : false
  var greedy = opts && opts.greedy !== undefined ?
    opts.greedy : false

  var syms = {}
  var gensym = function (name) {
    return name + (syms[name] = (syms[name] || 0) + 1)
  }

  var reversePatterns = {}
  var patterns = function (p) {
    if (reversePatterns[p]) return reversePatterns[p]
    var n = gensym('pattern')
    scope[n] = new RegExp(p)
    reversePatterns[p] = n
    return n
  }

  var vars = ['i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'x', 'y', 'z']
  var genloop = function () {
    var v = vars.shift()
    vars.push(v + v[0])
    return v
  }

  var visit = function (name, node, reporter, filter) {
    var properties = node.properties
    var type = node.type
    var tuple = false
    var i = 0
    var n = 0
    var keys = null
    var prev = null

    if (Array.isArray(node.items)) { // tuple type
      properties = {}
      node.items.forEach(function (item, i) {
        properties[i] = item
      })
      type = 'array'
      tuple = true
    }

    var indent = 0
    var error = function (code, node, prop, value) {
      var msg = errors.message(code, node)
      validate('errors++')
      if (reporter === true) {
        validate('if (validate.errors === null) validate.errors = []')
        if (verbose) {
          validate('validate.errors.push({code:%s,field:%s,message:%s,value:%s})', JSON.stringify(code), formatName(prop || name), JSON.stringify(msg), value || name)
        } else {
          validate('validate.errors.push({code:%s,field:%s,message:%s})', JSON.stringify(code), formatName(prop || name), JSON.stringify(msg))
        }
      }
    }

    if (node.required === true) {
      indent++
      validate('if (%s === undefined) {', name)
      error('required', node)
      validate('} else {')
    } else {
      indent++
      validate('if (%s !== undefined) {', name)
    }

    var valid = [].concat(type)
      .map(function (t) {
        return types[t || 'any'](name)
      })
      .join(' || ') || 'true'

    if (valid !== 'true') {
      indent++
      validate('if (!(%s)) {', valid)
      error('type', node)
      validate('} else {')
    }

    if (tuple) {
      if (node.additionalItems === false) {
        validate('if (%s.length > %d) {', name, node.items.length)
        error('additionalItems', node)
        validate('}')
      } else if (node.additionalItems) {
        i = genloop()
        validate('for (var %s = %d; %s < %s.length; %s++) {', i, node.items.length, i, name, i)
        visit(name + '[' + i + ']', node.additionalItems, reporter, filter)
        validate('}')
      }
    }

    if (node.format && fmts[node.format]) {
      if (type !== 'string' && formats[node.format]) validate('if (%s) {', types.string(name))
      n = gensym('format')
      scope[n] = fmts[node.format]

      if (typeof scope[n] === 'function') validate('if (!%s(%s)) {', n, name)
      else validate('if (!%s.test(%s)) {', n, name)
      error('format', node)
      validate('}')
      if (type !== 'string' && formats[node.format]) validate('}')
    }

    if (Array.isArray(node.required)) {
      var checkRequired = function (req) {
        var prop = genobj(name, req)
        validate('if (%s === undefined) {', prop)
        error('required', node, prop)
        validate('missing++')
        validate('}')
      }
      validate('if ((%s)) {', type !== 'object' ? types.object(name) : 'true')
      validate('var missing = 0')
      node.required.map(checkRequired)
      validate('}')
      if (!greedy) {
        validate('if (missing === 0) {')
        indent++
      }
    }

    if (node.uniqueItems) {
      if (type !== 'array') validate('if (%s) {', types.array(name))
      validate('if (!(unique(%s))) {', name)
      error('uniqueItems', node)
      validate('}')
      if (type !== 'array') validate('}')
    }

    if (node.enum) {
      var complex = node.enum.some(function (e) {
        return typeof e === 'object'
      })

      var compare = complex ?
        function (e) {
          return 'JSON.stringify(' + name + ')' + ' !== JSON.stringify(' + JSON.stringify(e) + ')'
        } :
        function (e) {
          return name + ' !== ' + JSON.stringify(e)
        }

      validate('if (%s) {', node.enum.map(compare).join(' && ') || 'false')
      error('enum', node)
      validate('}')
    }

    if (node.dependencies) {
      if (type !== 'object') validate('if (%s) {', types.object(name))

      Object.keys(node.dependencies).forEach(function (key) {
        var deps = node.dependencies[key]
        if (typeof deps === 'string') deps = [deps]

        var exists = function (k) {
          return genobj(name, k) + ' !== undefined'
        }

        if (Array.isArray(deps)) {
          validate('if (%s !== undefined && !(%s)) {', genobj(name, key), deps.map(exists).join(' && ') || 'true')
          error('dependencies', node)
          validate('}')
        }
        if (typeof deps === 'object') {
          validate('if (%s !== undefined) {', genobj(name, key))
          visit(name, deps, reporter, filter)
          validate('}')
        }
      })

      if (type !== 'object') validate('}')
    }

    if (node.additionalProperties || node.additionalProperties === false) {
      if (type !== 'object') validate('if (%s) {', types.object(name))

      i = genloop()
      keys = gensym('keys')

      var toCompare = function (p) {
        return keys + '[' + i + '] !== ' + JSON.stringify(p)
      }

      var toTest = function (p) {
        return '!' + patterns(p) + '.test(' + keys + '[' + i + '])'
      }

      var additionalProp = Object.keys(properties || {}).map(toCompare)
        .concat(Object.keys(node.patternProperties || {}).map(toTest))
        .join(' && ') || 'true'

      /*eslint-disable*/
      validate('var %s = Object.keys(%s)', keys, name)
        ('for (var %s = 0; %s < %s.length; %s++) {', i, i, keys, i)
          ('if (%s) {', additionalProp)
      /*eslint-enable*/

      if (node.additionalProperties === false) {
        if (filter) validate('delete %s', name + '[' + keys + '[' + i + ']]')
        error('additionalProperties', node, null, JSON.stringify(stripData(name + '.')) + ' + ' + keys + '[' + i + ']')
      } else {
        visit(name + '[' + keys + '[' + i + ']]', node.additionalProperties, reporter, filter)
      }

      /*eslint-disable*/
      validate
          ('}')
        ('}')
      /*eslint-enable*/

      if (type !== 'object') validate('}')
    }

    if (node.$ref) {
      var sub = get(root, opts && opts.schemas || {}, node.$ref)
      if (sub) {
        var fn = cache[node.$ref]
        if (!fn) {
          cache[node.$ref] = function proxy (data) {
            return fn(data)
          }
          fn = compile(sub, cache, root, false, opts)
        }
        n = gensym('ref')
        scope[n] = fn
        validate('if (!(%s(%s).valid)) {', n, name)
        error('$ref', node)
        validate('}')
      }
    }

    if (node.not) {
      prev = gensym('prev')
      validate('var %s = errors', prev)
      visit(name, node.not, false, filter)
      validate('if (%s === errors) {', prev)
      error('not', node)
      /*eslint-disable*/
      validate('} else {')
        ('errors = %s', prev)
      ('}')
      /*eslint-enable*/
    }

    if (node.items && !tuple) {
      if (type !== 'array') validate('if (%s) {', types.array(name))

      i = genloop()
      validate('for (var %s = 0; %s < %s.length; %s++) {', i, i, name, i)
      visit(name + '[' + i + ']', node.items, reporter, filter)
      validate('}')

      if (type !== 'array') validate('}')
    }

    if (node.patternProperties) {
      if (type !== 'object') validate('if (%s) {', types.object(name))
      keys = gensym('keys')
      i = genloop()

      /*eslint-disable*/
      validate('var %s = Object.keys(%s)', keys, name)
        ('for (var %s = 0; %s < %s.length; %s++) {', i, i, keys, i)
      /*eslint-enable*/

      Object.keys(node.patternProperties).forEach(function (key) {
        var p = patterns(key)
        validate('if (%s.test(%s)) {', p, keys + '[' + i + ']')
        visit(name + '[' + keys + '[' + i + ']]', node.patternProperties[key], reporter, filter)
        validate('}')
      })

      validate('}')
      if (type !== 'object') validate('}')
    }

    if (node.pattern) {
      var p = patterns(node.pattern)
      if (type !== 'string') validate('if (%s) {', types.string(name))
      validate('if (!(%s.test(%s))) {', p, name)
      error('pattern', node)
      validate('}')
      if (type !== 'string') validate('}')
    }

    if (node.allOf) {
      node.allOf.forEach(function (sch) {
        visit(name, sch, reporter, filter)
      })
    }

    if (node.anyOf && node.anyOf.length) {
      prev = gensym('prev')

      node.anyOf.forEach(function (sch, i) {
        if (i === 0) {
          validate('var %s = errors', prev)
        } else {
          validate('if (errors !== %s) {', prev)('errors = %s', prev)
        }
        visit(name, sch, false, false)
      })
      node.anyOf.forEach(function (sch, i) {
        if (i) validate('}')
      })
      validate('if (%s !== errors) {', prev)
      error('anyOf', node)
      validate('}')
    }

    if (node.oneOf && node.oneOf.length) {
      prev = gensym('prev')
      var passes = gensym('passes')

      validate('var %s = errors', prev)('var %s = 0', passes)

      node.oneOf.forEach(function (sch, i) {
        visit(name, sch, false, false)
        /*eslint-disable*/
        validate('if (%s === errors) {', prev)
          ('%s++', passes)
        ('} else {')
          ('errors = %s', prev)
        ('}')
        /*eslint-enable*/
      })

      validate('if (%s !== 1) {', passes)
      error('oneOf', node)
      validate('}')
    }

    if (node.multipleOf !== undefined) {
      if (type !== 'number' && type !== 'integer') validate('if (%s) {', types.number(name))

      var factor = ((node.multipleOf | 0) !== node.multipleOf) ? Math.pow(10, node.multipleOf.toString().split('.').pop().length) : 1
      if (factor > 1) validate('if ((%d*%s) % %d) {', factor, name, factor * node.multipleOf)
      else validate('if (%s % %d) {', name, node.multipleOf)

      error('multipleOf', node)
      validate('}')

      if (type !== 'number' && type !== 'integer') validate('}')
    }

    if (node.maxProperties !== undefined) {
      if (type !== 'object') validate('if (%s) {', types.object(name))

      validate('if (Object.keys(%s).length > %d) {', name, node.maxProperties)
      error('maxProperties', node)
      validate('}')

      if (type !== 'object') validate('}')
    }

    if (node.minProperties !== undefined) {
      if (type !== 'object') validate('if (%s) {', types.object(name))

      validate('if (Object.keys(%s).length < %d) {', name, node.minProperties)
      error('minProperties', node)
      validate('}')

      if (type !== 'object') validate('}')
    }

    if (node.maxItems !== undefined) {
      if (type !== 'array') validate('if (%s) {', types.array(name))

      validate('if (%s.length > %d) {', name, node.maxItems)
      error('maxItems', node)
      validate('}')

      if (type !== 'array') validate('}')
    }

    if (node.minItems !== undefined) {
      if (type !== 'array') validate('if (%s) {', types.array(name))

      validate('if (%s.length < %d) {', name, node.minItems)
      error('minItems', node)
      validate('}')

      if (type !== 'array') validate('}')
    }

    if (node.maxLength !== undefined) {
      if (type !== 'string') validate('if (%s) {', types.string(name))

      validate('if (%s.length > %d) {', name, node.maxLength)
      error('maxLength', node)
      validate('}')

      if (type !== 'string') validate('}')
    }

    if (node.minLength !== undefined) {
      if (type !== 'string') validate('if (%s) {', types.string(name))

      validate('if (%s.length < %d) {', name, node.minLength)
      error('minLength', node)
      validate('}')

      if (type !== 'string') validate('}')
    }

    if (node.minimum !== undefined) {
      validate('if (%s %s %d) {', name, node.exclusiveMinimum ? '<=' : '<', node.minimum)
      error('minimum', node)
      validate('}')
    }

    if (node.maximum !== undefined) {
      validate('if (%s %s %d) {', name, node.exclusiveMaximum ? '>=' : '>', node.maximum)
      error('maximum', node)
      validate('}')
    }

    if (properties) {
      Object.keys(properties).forEach(function (p) {
        visit(genobj(name, p), properties[p], reporter, filter)
      })
    }

    while (indent--) validate('}')
  }

  /*eslint-disable*/
  var validate = genfun
    ('function validate(data) {')
      ('validate.errors = null')
      ('var errors = 0')
  /*eslint-enable*/

  visit('data', schema, reporter, opts && opts.filter)

  /*eslint-disable*/
  validate
    ('return {valid: errors === 0, errors: validate.errors}')
    ('}')
  /*eslint-enable*/

  validate = validate.toFunction(scope)
  validate.errors = null

  validate.__defineGetter__('error', function () {
    if (!validate.errors) return ''
    return validate.errors
      .map(function (err) {
        return err.field + ' ' + err.message
      })
      .join('\n')
  })

  validate.toJSON = function () {
    return schema
  }

  return validate
}

module.exports = function (schema, opts) {
  if (typeof schema === 'string') schema = JSON.parse(schema)
  return compile(schema, {}, schema, true, opts)
}

module.exports.filter = function (schema, opts) {
  var validate = module.exports(schema, xtend(opts, {filter: true}))
  return function (sch) {
    validate(sch)
    return sch
  }
}
