import _ from 'lodash';
import { CALL_API } from 'redux-api-middleware';
import moment from 'moment';

// Handle browsers running older versions of JS
if (![].includes) {
  Array.prototype.includes = (obj) => this.indexOf(obj) !== -1;
};

if (!''.includes) {
  String.prototype.includes = (chars) => this.indexOf(chars) !== -1;
};


/** Turns a type string into an object of base and end
 * @param {String} type An FSAA action type (ie 'SOME_SUCCESS')
 * @return {Object} An object with 'base' and 'end' keys
 */
export function parseActionType(type) {
  const array = type.split('_');

  return {
    base: array.slice(0, array.length - 1).join('_'),
    end: array[array.length - 1]
  };
}

/**
 * Takes an API action and gets the possible action responses.
 * Usually [SOMEACTION_REQUEST, SOMEACTION_SUCCESS, SOMEACTION_FAILED]
 * @param  {Object} action A valid redux API action
 * @return {Array}        An array of api action responses
 */
export function getResponseTypesFromAction(action) {
  return action[CALL_API].types
    .map(actionInfo => {
      if (typeof actionInfo === 'string') {
        return actionInfo;
      } else {
        return actionInfo.type;
      }
    });
}

/**
 * Takes an API action and gets the ID (if any) given in the request.
 * @param  {Object} action A valid redux API action
 * @return {Number}        A site ID
 */
export function getIDFromAction(action) {
  const firstType = action[CALL_API].types[0];
  return firstType.meta && firstType.meta.id;
}

class RequestManager {
  constructor(dispatch, options = {}) {
    window.actionLogs = window.actionLogs || {};
    this.requestThrottleSeconds = options.requestThrottleSeconds || 10;
    this.freshnessCutoffSeconds = options.freshnessCutoffSeconds || 300;
    this._dispatch = dispatch || (() => {
      console.warn('RequestManager needs to be initialized with a dispatch function.');
    });
  }

  /**
   * Logs and dispatches an action
   * @param  {Object} action Action object
   * @memberof RequestManager
   */
  dispatch(action) {
    this.writeLogFromAction(action);
    this._dispatch(action);
  }

  /**
   * Takes an api action object and dispatches it if there's no request in the log
   * @param  {Object} actionObj A redux FSAA
   * @memberof RequestManager
   */
  dispatchIfHaventAlready(actionObj) {
    if (!this.findLogFromAction(actionObj)) {
      this.dispatch(actionObj);
    }
  }

  /** Takes an API action object
   *  and returns a bool for whether it has been recently dispatched.
   *  @param {Object} actionObj A redux FSAA
   *  @return {Boolean} True if it has dispatched recently; false if not
   */
  haveRequestedRecently(actionObj, secondsCutoff = this.requestThrottleSeconds) {
    const requestTime = this.findLogFromAction(actionObj);
    return requestTime && moment().diff(requestTime, 'seconds') < secondsCutoff; // Throttle requests
  }

  /** Takes an API action object and second argument of minutes of freshness,
   *  and returns a bool for whether it has succeeded since the freshness cutoff.
   *  @param {Object} actionObj A redux FSAA
   *  @param {Number} secondsCutoff Number of minutes beyond which data is considered unfresh
   *  @return {Boolean} True if it has succeeded since the cutoff; false if not
   */
  haveSucceededSinceCutoff(actionObj, secondsCutoff = this.freshnessCutoffSeconds) { // 5 minute default
    const successTime = this.findLogFromAction(actionObj, 'SUCCESS');
    return successTime && moment().diff(successTime, 'seconds') < secondsCutoff;
  }

  /** Returns a flattened version of the actionLogs tree
   *  needs no arguments (just uses them recursively)
   *  @return {Array} Flat list of strings representing executed actions
   */
  flattenedLogs(object = window.actionLogs, string) {
    const multiDimensional = Object.keys(object).map(key => {
      const val = object[key];
      if (typeof val === 'object') {
        return this.flattenedLogs(val, _.compact([string, key]).join('--'));
      } else {
        return _.compact([string, key, val]).join('--');
      }
    });
    return _.flattenDeep(multiDimensional);
  }


  // PATH LOGGING FUNCTIONS //

  writeLog(objectPath, timestamp = Date().toISOString()) {
    _.set(window.actionLogs, objectPath, timestamp);
  }

  findLog(objectPath) {
    return _.get(window.actionLogs, objectPath);
  }

  removeLog(objectPath) {
    _.unset(window.actionLogs, objectPath);
  }


  // ACTION LOGGING FUNCTIONS //

  writeLogFromAction(action) {
    const now = action.now || new Date().toISOString();
    this.writeLog(this._pathToLogFromAction(action), now);
  }

  findLogFromAction(action, specifiedEnd) {
    let path = this._pathToLogFromAction(action);
    if (specifiedEnd) {
      const array = path.split('.');
      array.pop();
      path = [...array, specifiedEnd].join('.');
    }
    return this.findLog(path);
  }


  // HELPERS //

  _pathToLogFromAction(action) {
    if (action.type) { // Normal action, or returning async
      const parsedType = parseActionType(action.type);
      if (['REQUEST', 'SUCCESS', 'FAILURE'].includes(parsedType.end)) {
        return this._asyncReturnPath(action, parsedType);
      } else {
        return this._normalActionPath(action);
      }
    } else { // An async action going out
      return this._emittingAsyncPath(action);
    }
  }

  _asyncReturnPath(action, parsedType) {
    const actionID = action.meta && action.meta.id;
    const id = actionID ? `ID_${actionID}` : 'GLOBAL'
                  .toString().toUpperCase();
    return `${parsedType.base}.${id}.${parsedType.end}`;
  }

  _normalActionPath(action) {
    const actionID = action.siteID || action.id;
    const id = actionID ? `ID_${actionID}` : 'GLOBAL';

    // Add all printable args to log, for specificity
    const specifiers = Object.keys(action)
      .filter(k => ['string', 'number'].includes(typeof action[k]) &&
                  !['type', 'siteID', 'id', 'now'].includes(k))
      .map(s => action[s].toString().toUpperCase());

    const base = [action.type, id].join('.');
    return specifiers.length > 0 ? `${base}.${specifiers.join('_')}` : base;
  }

  _emittingAsyncPath(action) {
    const type = getResponseTypesFromAction(action)[0];
    const actionID = getIDFromAction(action);
    const id = actionID ? `ID_${actionID}` : 'GLOBAL';
    const parsedType = parseActionType(type);

    return `${parsedType.base}.${id}.${parsedType.end}`;
  }
}

RequestManager.actionTrackerReducer = (actionsNotToTrack) => (state, action) => {
  // Ignore init actions
  if (!_.some(['@', ...actionsNotToTrack], t => action.type.includes(t))) {
    new RequestManager().writeLogFromAction(action);
  }
  return 'This reducer is for tracking alone and does not return viable data.';
};

export default RequestManager;
