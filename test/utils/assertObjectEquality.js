import _ from 'lodash';

export const assertObjectEquality = (t, obj1, obj2) => {
  if (_.isEqual(obj1, obj2)) {
    t.pass()
  } else {
    const print = obj => JSON.stringify(obj, null, 2);
    t.fail(`\nExpected object equality:\n${print(obj1)}\n\n${print(obj2)}\n`);
  }
};