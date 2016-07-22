import { describe, context } from 'ava-describe';
import { jsdom } from 'jsdom';
import { CALL_API } from 'redux-api-middleware';

import RequestManager from '../src/RequestManager';
import { assertObjectEquality } from './utils/assertObjectEquality';

// Setup for window
const doc = jsdom('<!doctype html><html><body></body></html>');
global.document = doc;
global.window = doc.defaultView;


const rm = new RequestManager();
const resetWindowLogger = () => { window.actionLogs = {}; };

const fakeAPIAction = (id, type) => ({
  [CALL_API]: {
    endpoint: 'https://someurl.com/api/'.concat(id ? id + '/' : '').concat(type.toLowerCase()),
    types: ['REQUEST', 'SUCCESS', 'FAILURE'].map(typeEnd => ({
      type: [type, typeEnd].join('_'),
      meta: id ? { id } : {},
      payload: {}
    })),
    headers:  {
      Authorization: 'Bearer undefined',
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  }
});

const fakeAction = (id, type) => ({
  id: id ? id : undefined,
  type,
  value: 'Whatever',
  value2: 'Whatever2'
});

const writeABunchOfLogs = () => {
  rm.writeLogFromAction(Object.assign(
    fakeAPIAction(1, 'APPLES'),
    { now: 'time1' }
  ));
  rm.writeLogFromAction(Object.assign(
    fakeAPIAction(2, 'APPLES'),
    { now: 'time2' }
  ));
  rm.writeLogFromAction(Object.assign(
    fakeAPIAction(2, 'ORANGES'),
    { now: 'time2' }
  ));
  rm.writeLogFromAction(Object.assign(
    fakeAPIAction(undefined, 'BANANAS'),
    { now: 'time3' }
  ));
  rm.writeLogFromAction(Object.assign(
    fakeAction('internalAction', 'KIWIS'),
    { now: 'time4' }
  ));
  rm.writeLogFromAction({
    type: 'APPLES_SUCCESS',
    meta: { id: 2 },
    payload: { data: {} },
    now: 'time5'
  });
};

describe('RequestManager', {
  _pathToLogFromAction: {
    generatesTheCorrectPathFromAnOutgoingAsyncAction: t => {
      resetWindowLogger();
      const path = rm._pathToLogFromAction(fakeAPIAction(46, 'APPLES'));
      t.is(path, '46.APPLES.REQUEST');
    },
    generatesTheCorrectPathFromAnOutgoingAsyncActionWithoutID: t => {
      resetWindowLogger();
      const path = rm._pathToLogFromAction(fakeAPIAction(undefined, 'BANANAS'));
      t.is(path, 'GLOBAL.BANANAS.REQUEST');
    },
    generatesTheCorrectPathFromAnIncomingAsyncAction: t => {
      resetWindowLogger();
      const path = rm._pathToLogFromAction({
        type: 'APPLES_SUCCESS',
        meta: { id: 46 },
        payload: { data: {} }
      });
      t.is(path, '46.APPLES.SUCCESS');
    },
    generatesTheCorrectPathFromAnIncomingAsyncActionWithoutID: t => {
      resetWindowLogger();
      const path = rm._pathToLogFromAction({
        type: 'BANANAS_SUCCESS',
        payload: { data: {} }
      });
      t.is(path, 'GLOBAL.BANANAS.SUCCESS');
    },
    generatesTheCorrectPathFromANormalActionWithAnID: t => {
      resetWindowLogger();
      const path = rm._pathToLogFromAction(fakeAction(36, 'MULTI_ARG'));
      t.is(path, '36.MULTI_ARG.WHATEVER_WHATEVER2');
    },
    generatesTheCorrectPathFromANormalActionWithoutAnID: t => {
      resetWindowLogger();
      const path = rm._pathToLogFromAction(fakeAction(undefined, 'MULTI_ARG'));
      t.is(path, 'GLOBAL.MULTI_ARG.WHATEVER_WHATEVER2');
    }
  },

  writeLogFromAction: {
    writesLogsCorrectlyOnTopOfOneAnother: t => {
      resetWindowLogger();
      rm.writeLogFromAction(Object.assign(
        fakeAPIAction(46, 'SOME_ACTION'),
        { now: 'time1' }
      ));

      assertObjectEquality(t, window.actionLogs, {
        46: { SOME_ACTION: { REQUEST: 'time1' } }
      });

      rm.writeLogFromAction(Object.assign(
        fakeAPIAction(155, 'SOME_ACTION'),
        { now: 'time2' }
      ));

      assertObjectEquality(t, window.actionLogs, {
        46: { SOME_ACTION: { REQUEST: 'time1' } },
        155: { SOME_ACTION: { REQUEST: 'time2' } }
      });

      rm.writeLogFromAction(Object.assign(
        fakeAPIAction(undefined, 'OTHER_ACTION'),
        { now: 'time3' }
      ));

      assertObjectEquality(t, window.actionLogs, {
        46: { SOME_ACTION: { REQUEST: 'time1' } },
        155: { SOME_ACTION: { REQUEST: 'time2' } },
        GLOBAL: { OTHER_ACTION: { REQUEST: 'time3' } }
      });

      rm.writeLogFromAction({
        type: 'SOME_ACTION_SUCCESS',
        meta: { id: 46 },
        payload: { data: {} },
        now: 'time4'
      });

      assertObjectEquality(t, window.actionLogs, {
        46: { SOME_ACTION: { REQUEST: 'time1', SUCCESS: 'time4' } },
        155: { SOME_ACTION: { REQUEST: 'time2' } },
        GLOBAL: { OTHER_ACTION: { REQUEST: 'time3' } }
      });

      rm.writeLogFromAction(Object.assign(
        { type: 'THIRD_ACTION', id: 155, key: 'value', otherKey: 4, finalKey: 'finalValue' },
        { now: 'time5' }
      ));

      assertObjectEquality(t, window.actionLogs, {
        46: { SOME_ACTION: { REQUEST: 'time1', SUCCESS: 'time4' } },
        155: { SOME_ACTION: { REQUEST: 'time2' }, THIRD_ACTION: { VALUE_4_FINALVALUE: 'time5' } },
        GLOBAL: { OTHER_ACTION: { REQUEST: 'time3' } }
      });

      rm.writeLogFromAction(Object.assign(
        fakeAction(undefined, 'FOURTH_ACTION'),
        { now: 'time6' }
      ));

      assertObjectEquality(t, window.actionLogs, {
        46: { SOME_ACTION: { REQUEST: 'time1', SUCCESS: 'time4' } },
        155: { SOME_ACTION: { REQUEST: 'time2' }, THIRD_ACTION: { VALUE_4_FINALVALUE: 'time5' } },
        GLOBAL: { OTHER_ACTION: { REQUEST: 'time3' }, FOURTH_ACTION: { WHATEVER_WHATEVER2: 'time6' } }
      });
    }
  },

  findLogFromAction: {
    findsTheLogFromTheAction: t => {
      resetWindowLogger();

      writeABunchOfLogs();

      t.is(
        rm.findLogFromAction(fakeAPIAction(1, 'APPLES')),
        'time1'
      );
      t.is(
        rm.findLogFromAction(fakeAPIAction(2, 'ORANGES')),
        'time2'
      );
      t.is(
        rm.findLogFromAction(fakeAPIAction(2, 'APPLES')),
        'time2'
      );
      t.is(
        rm.findLogFromAction(fakeAPIAction(undefined, 'BANANAS')),
        'time3'
      );
      t.is(
        rm.findLogFromAction(fakeAction('internalAction', 'KIWIS')),
        'time4'
      );
      t.is(
        rm.findLogFromAction(fakeAPIAction(3, 'APPLES')),
        undefined
      );

      t.is(
        rm.findLogFromAction({
          type: 'APPLES_SUCCESS',
          meta: { id: 2 },
          payload: { data: {} },
          now: 'time5'
        }),
        'time5'
      );
    }
  },

  flattenedLogs: {
    spitsOutAnArrayVersionOfTheTree: t => {
      resetWindowLogger();
      writeABunchOfLogs();
      t.deepEqual(
        rm.flattenedLogs().sort(),
        [
          '1--APPLES--REQUEST--time1',
          '2--APPLES--REQUEST--time2',
          '2--APPLES--SUCCESS--time5',
          '2--ORANGES--REQUEST--time2',
          'GLOBAL--BANANAS--REQUEST--time3',
          'INTERNALACTION--KIWIS--WHATEVER_WHATEVER2--time4'
        ].sort()
      );
    }
  }
});
