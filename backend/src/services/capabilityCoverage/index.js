'use strict';

require('./registerDefaultAdapters');

module.exports = {
    ...require('./coverageTypes'),
    ...require('./coverageRegistry'),
    ...require('./coverageEngine.service'),
};
