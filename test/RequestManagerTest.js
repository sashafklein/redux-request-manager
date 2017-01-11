import _ from 'lodash';
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
    fakeAction(undefined, 'KIWIS'),
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
  pathToLogFromAction: {
    generatesTheCorrectPathFromAnOutgoingAsyncAction: t => {
      resetWindowLogger();
      const path = rm.pathToLogFromAction(fakeAPIAction(46, 'APPLES'));
      t.is(path, 'APPLES.ID_46.REQUEST');
    },
    generatesTheCorrectPathFromAnOutgoingAsyncActionWithoutID: t => {
      resetWindowLogger();
      const path = rm.pathToLogFromAction(fakeAPIAction(undefined, 'BANANAS'));
      t.is(path, 'BANANAS.GLOBAL.REQUEST');
    },
    generatesTheCorrectPathFromAnIncomingAsyncAction: t => {
      resetWindowLogger();
      const path = rm.pathToLogFromAction({
        type: 'APPLES_SUCCESS',
        meta: { id: 46 },
        payload: { data: {} }
      });
      t.is(path, 'APPLES.ID_46.SUCCESS');
    },
    generatesTheCorrectPathFromAnIncomingAsyncActionWithoutID: t => {
      resetWindowLogger();
      const path = rm.pathToLogFromAction({
        type: 'BANANAS_SUCCESS',
        payload: { data: {} }
      });
      t.is(path, 'BANANAS.GLOBAL.SUCCESS');
    },
    generatesTheCorrectPathFromANormalActionWithAnID: t => {
      resetWindowLogger();
      const path = rm.pathToLogFromAction(fakeAction(36, 'MULTI_ARG'));
      t.is(path, 'MULTI_ARG.ID_36.WHATEVER_WHATEVER2');
    },
    generatesTheCorrectPathFromANormalActionWithoutAnID: t => {
      resetWindowLogger();
      const path = rm.pathToLogFromAction(fakeAction(undefined, 'MULTI_ARG'));
      t.is(path, 'MULTI_ARG.GLOBAL.WHATEVER_WHATEVER2');
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
        SOME_ACTION: { ID_46: { REQUEST: 'time1' } }
      });

      rm.writeLogFromAction(Object.assign(
        fakeAPIAction(155, 'SOME_ACTION'),
        { now: 'time2' }
      ));

      assertObjectEquality(t, window.actionLogs, {
        SOME_ACTION: {
          ID_46: { REQUEST: 'time1' },
          ID_155: { REQUEST: 'time2' }
        }
      });

      rm.writeLogFromAction(Object.assign(
        fakeAPIAction(undefined, 'OTHER_ACTION'),
        { now: 'time3' }
      ));

      assertObjectEquality(t, window.actionLogs, {
        SOME_ACTION: { ID_46: { REQUEST: 'time1' }, ID_155: { REQUEST: 'time2' } },
        OTHER_ACTION: { GLOBAL: { REQUEST: 'time3' } }
      });

      rm.writeLogFromAction({
        type: 'SOME_ACTION_SUCCESS',
        meta: { id: 46 },
        payload: { data: {} },
        now: 'time4'
      });

      assertObjectEquality(t, window.actionLogs, {
        SOME_ACTION: { ID_46: { REQUEST: 'time1', SUCCESS: 'time4' }, ID_155: { REQUEST: 'time2' } },
        OTHER_ACTION: { GLOBAL: { REQUEST: 'time3' } }
      });

      rm.writeLogFromAction(Object.assign(
        { type: 'THIRD_ACTION', id: 155, key: 'value', otherKey: 4, finalKey: 'finalValue' },
        { now: 'time5' }
      ));

      assertObjectEquality(t, window.actionLogs, {
        SOME_ACTION: {
          ID_46: { REQUEST: 'time1', SUCCESS: 'time4' },
          ID_155: { REQUEST: 'time2' }
        },
        THIRD_ACTION: {
          ID_155: { VALUE_4_FINALVALUE: 'time5' }
        },
        OTHER_ACTION: {
          GLOBAL: { REQUEST: 'time3' }
        }
      });

      rm.writeLogFromAction(Object.assign(
        fakeAction(undefined, 'FOURTH_ACTION'),
        { now: 'time6' }
      ));

      assertObjectEquality(t, window.actionLogs, {
        SOME_ACTION: {
          ID_46: { REQUEST: 'time1', SUCCESS: 'time4' },
          ID_155: { REQUEST: 'time2' }
        },
        THIRD_ACTION: {
          ID_155: { VALUE_4_FINALVALUE: 'time5' }
        },
        OTHER_ACTION: {
          GLOBAL: { REQUEST: 'time3' }
        },
        FOURTH_ACTION: {
          GLOBAL: { 'WHATEVER_WHATEVER2': 'time6' }
        }
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
        rm.findLogFromAction(fakeAction(undefined, 'KIWIS')),
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
          "APPLES--ID_1--REQUEST--time1",
          "APPLES--ID_2--REQUEST--time2",
          "APPLES--ID_2--SUCCESS--time5",
          "BANANAS--GLOBAL--REQUEST--time3",
          "KIWIS--GLOBAL--WHATEVER_WHATEVER2--time4",
          "ORANGES--ID_2--REQUEST--time2"
        ].sort()
      );
    }
  },

  actionTrackerReducer: {
    generatesAFunctionThatActsAsATrackingReducer: t => {
      resetWindowLogger();
      const reducer = RequestManager.actionTrackerReducer(['IGNORE']);
      const returnVal = reducer('irrelevant', { type: 'GOOD', value: 'VALUE', value2: 'value2', now: 'time' });

      t.is(returnVal, 'This reducer is for tracking alone and does not return viable data.'); // Ignores state

      const logsAfterFirst = window.actionLogs;
      t.is(_.get(window.actionLogs, 'GOOD.GLOBAL.VALUE_VALUE2'), 'time')

      reducer('irrelevant', { type: 'IGNORE_REQUEST', value: 'VALUE', value2: 'value2', now: 'time2' });

      t.is(_.get(window.actionLogs, 'IGNORE_REQUEST.GLOBAL.VALUE_VALUE2'), undefined);
      t.deepEqual(logsAfterFirst, window.actionLogs);
    }
  }
});
