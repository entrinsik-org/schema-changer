'use strict';
const hooks = require('ent-hooks');

exports.register = function (server, opts, next) {
    hooks.on('import.beforeMerge', require('./lib/schema-changer'));
    next();
};

exports.register.attributes = { name: 'schema-changer' };

