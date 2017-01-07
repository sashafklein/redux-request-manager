# Redux Request Manager

Attaches a lightweight object to window which tracks request history as a tree and provides a simple interface for tracking actions going out through redux-api-middleware or internally.

> Event timestamps are stored as ISO strings, and request ids (or, if none exist, 'GLOBAL') as well as action argument values are nested in the tree.

An example `window.actionLogs` object looks something like this:

```json
{
  "SOME_ACTION": {
     "ID_46": { "REQUEST": "2016-10-06T23:38:46.637Z" },
  },
  "OTHER_ACTION": {
    "ID_46": {
     "SPECIFYINGVALUE1_VALUE2": "2016-10-06T23:38:45.872Z",
    }
  },
  "ACTION_WITHOUT_ID": {
    "GLOBAL": {
      "REQUEST": "2016-10-06T23:38:44.980Z",
      "SUCCESS": "2016-10-06T23:38:45.776Z"
    }
  },
  "NON_API_ACTION_WITHOUT_ID": {
    "GLOBAL: {
      "SPECIFIER1_SPECIFIER2": "2016-10-06T23:38:44.873Z"
    }
  }
}
```

After the first request has been made with the manager, this object should be universally accessible, and all instances of the request manager will save to and perform checks on this global tree.

> This is obviously inherently insecure. If any of the information in an action is insecure, don't use it for those actions and ignore those actions in the reducer function. However, since this mostly just stores times of requests, the information is generally not a risk to expose.

## Getting started

```
npm install --save redux-request-manager
```

## Incorporating the RequestManager

Add this to your reducers file:

```js
import RequestManager from 'redux-request-manager';

// ...

combineReducers({
  someReducer: reducerFunction,
  rm: RM.actionTrackerReducer(['ARRAY', 'OF', 'ACTIONS', 'NOT', 'TO', 'BE', 'TRACKED'])
})
```

This will add a reducer function which tracks every action that hits your store -- both local action and API requests, successes, and failures.

Unfortunately, there can be a bit of a delay for the action to hit the store and come back to your component, so if you need to throttle or stop dispatches (say, to a slow API), you'll also want to dispatch using the request manager, like so:

```jsx
import { connect } from 'react-redux';

import { someApiAction } from '../actions';
import RM from 'redux-request-manager';

function SomeComponent ({ dispatch }) {
  const rm = new RM(dispatch);

  return (
    <a onClick={ () => { rm.dispatch(someApiAction()) } }>Click me</a>
  );
}
```

This will call `dispatch` and simultaneously store a record of the request, before the redux store has been hit.

## Other Methods

### Primary Public API

#### dispatchIfHaventAlready(actionObj)

Ensures that the action is only dispatched if it hasn't been before.

```js
// Will only dispatch once
[0, 1, 2].forEach(() => {
  rm.dispatchIfHaventAlready(apiAction())
})

// Will dispatch 3 times -- once with each number argument, without repeating
[0, 1, 2, 0, 1, 2].forEach((number) => {
  rm.dispatchIfHaventAlready(apiAction(number))
})
```

#### haventRequestedRecently(actionObj, secondsCutoff)

Returns bool for whether the request has been made  in within the given cutoff (defaults to 40s), or the `requestThrottleSeconds` number passed in at initialization.

```js
const rm = new RequestManager(dispatch, { requestThrottleSeconds: 5 });

// True if it's been requested in last 5 seconds
rm.haveRequestedRecently(apiAction(number));
```

#### haveSucceededSinceCutoff(actionObj, secondsCutoff)

Returns bool for whether the request has succeeded within the given cutoff (defaults to 300s), or the `freshnessCutoffSeconds` number passed in at initialization.

```js
const rm = new RequestManager(dispatch, { freshenessCutoffSeconds: 120 });

// True if it's succeeded in the last two minutes
rm.haveSucceededSinceCutoff(apiAction(number));
```

#### flattenedLogs(object)

Returns a flat array representing all actions dispatched.

```js
// Defaults to logging the window.actionLogs object, but can be
// given a different object, as well as a second arg which will be prepended
// to each element in the flattened log
rm.flattenedLogs()
```

### Path Logging Functions

#### writeLog(objectPath, timestamp)

Given a string object-notation path to the logging location  and a timestampt for that action, logs it to the `actionLogs` object.

```js
// ie a log for a successful API hit for SOME_ACTION for user 36
rm.writeLog('36.SOME_ACTION.SUCCESS', "2017-01-06T19:59:02.323Z");
```

#### findLog(objectPath)

Returns the timestamp for a given action, if found.

```js
rm.findLog('36.SOME_ACTION.SUCCESS') // "2017-01-06T19:59:02.323Z"
```

#### removeLog(objectPath)

Deletes the log at the given path from the actionLogs object, erasing history of that request.

#### writeLogFromAction(action)

Like `writeLog`, but takes an action and infers the path. Takes timestamp from `action.now` or sets it to the current ISO string.

#### findLogFromAction(action, specifiedEnd)

Like `findLog`, but takes an action and action ending (ie `_REQUEST` or `_SUCCESS`), and finds the log for that event for that action.