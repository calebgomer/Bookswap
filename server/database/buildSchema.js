var pg = require('pg');
var _ = require('underscore');
var util = require('util');
var async = require('async');
var schema = require('./schema');

// create all the custom types
function createCustomTypes(callback) {
  if (!schema.types) {
    console.log('no custom types to create');
    return callback();
  }
  async.eachSeries(schema.types, function(type, callback) {
    pg.connect(process.env.DATABASE_URL, function(err, client, done) {
      if (err) {
        console.error('error getting client from pool', err);
        return callback(err);
      }
      client.query(util.format('drop type if exists %s cascade;', type.name), function(err, result) {
        if (err) {
          done();
          console.error(util.format('error dropping custom type %s', type.name), err);
          return callback(err);
        }
        var newType = '';
        if (type.enum) {
          newType = util.format('create type %s as enum (\'%s\');', type.name, type.values.join('\',\''));
        } else {
          newType = util.format('create type %s as (', type.name);
          _.each(type.fields, function(field, i) {
            newType += util.format('%s %s', field.name, field.type);
            if (i !== type.fields.length-1) {
              newType += ',';
            }
          });
          newType += ');';
        }
        client.query(newType, function(err, result) {
          done();
          if (err) {
            console.error(util.format('error creating custom type %s', type.name), err);
          } else {
            console.log(util.format('created custom type %s', type.name));
          }
          callback(err);
        });
      });
    });
  }, callback);
}

// create all the tables
function createTables(callback) {
  if (!schema.tables) {
    console.log('no tables to create');
    return callback();
  }
  async.eachSeries(schema.tables, function(table, callback) {
    pg.connect(process.env.DATABASE_URL, function(err, client, done) {
      if (err) {
        console.error('error getting client from pool', err);
        return callback(err);
      }
      client.query(util.format('drop table if exists %s cascade;', table.name), function(err, result) {
        if (err) {
          done();
          console.error(util.format('error dropping table %s', table.name), err);
          return callback(err);
        }
        var newTable = util.format('create table %s (', table.name);
        _.each(table.fields, function(field, i) {
          newTable += util.format('%s %s', field.name, field.type);
          if (field.primary) {
            newTable += ' primary key';
          }
          if (field.references) {
            newTable += util.format(' references %s(%s)', field.references, field.name);
            if (field.ondelete) {
              newTable += util.format(' on delete %s', field.ondelete);
            }
          }
          if (field.default || typeof field.default === 'boolean') {
            newTable += ' default ' + field.default;
          } else if (!field.null) {
            newTable += ' not null';
          }
          if (i !== table.fields.length-1) {
            newTable += ',';
          }
        });
        if (Array.isArray(table.compositePrimaryKeys)) {
          newTable += util.format(', primary key(%s)',table.compositePrimaryKeys.join(','));
        }
        newTable += ');';
        client.query(newTable, function(err, result) {
          done();
          if (err) {
            console.error(util.format('error creating table %s', table.name), err);
          } else {
            console.log(util.format('created table %s', table.name));
          }
          callback(err);
        });
      });
    });
  }, callback);
}

// create all extensions
function createExtentions(callback) {
  if (!schema.extensions) {
    console.log('no extensions to create');
    return callback();
  }
  async.eachSeries(schema.extensions, function(extension, callback) {
    pg.connect(process.env.DATABASE_URL, function(err, client, done) {
      if (err) {
        console.error('error getting client from pool', err);
        return callback(err);
      }
      client.query(util.format('drop extension if exists %s cascade;', extension.name), function(err, result) {
        if (err) {
          console.error(util.format('error dropping extension %s', extension.name), err);
          return callback(err);
        }
        client.query(util.format('create extension %s;', extension.name), function(err, result) {
          done();
          if (err) {
            console.error(util.format('error creating extension %s', extension.name), err);
          } else {
            console.log(util.format('created extension %s', extension.name));
          }
          callback(err);
        });
      })
    });
  }, callback);
}

async.series([
    createCustomTypes,
    createTables,
    createExtentions
  ],
  function(err) {
    if (err) {
      console.error(err);
    }
    else {
      console.log('done, no errors');
    }
    pg.end();
  }
);
