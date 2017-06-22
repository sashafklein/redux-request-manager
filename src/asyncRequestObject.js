import { CALL_API } from 'redux-api-middleware';

const addArgToResponse = (responseType, endpoint, metaInfo = {}) => {
  const response = {
    type: responseType,
    meta: Object.assign({ endpoint }, metaInfo),
    payload: (action, state, res) => {
      if (!res) return metaInfo; // Dispatching response

      const contentType = res.headers.get('Content-Type');

      // JSON response
      if (contentType && contentType.indexOf('json') >= 0) {
        return res.json()
          .then(json => Object.assign(metaInfo, json));

      // Non-JSON response
      } else {
        return res.text()
          .then(text => Object.assign(metaInfo, { status: res.status }, text ? { text } : {}));
      }
    }
  };

  return response;
};

// Helper function for constructing FSAAs
export default function asyncRequestObject (
  typeBase,
  endpoint, {
    meta = {},
    method = 'GET',
    headerAdditions = {},
    data,
    body
  } = {}
) {
  const types = ['REQUEST', 'SUCCESS', 'FAILURE']
          .map(ending => [typeBase, ending].join('_'))
          .map(type => addArgToResponse(type, endpoint, meta));

  const object = {
    endpoint,
    method,
    types,
    headers: Object.assign({
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }, headerAdditions)
  };

  const dataObj = data || body;

  if (dataObj) { object.body = JSON.stringify(dataObj); }

  return {
    [CALL_API]: object
  };
};
