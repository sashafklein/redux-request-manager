import { CALL_API } from 'redux-api-middleware';

const addArgToResponse = (responseType, endpoint, metaInfo = {}) => {
  const response = {
    type: responseType,
    meta: Object.assign({ endpoint }, metaInfo),
    payload: (action, state, res) => {
      if (!res) return metaInfo; // Dispatching response

      const contentType = res.headers.get('Content-Type');

      // Ensure res.json() does not raise an error
      if (!(contentType && ~contentType.indexOf('json'))) {
        throw new Error('Invalid object received. Expected JSON.');
      }

      return res.json()
        .then(json => Object.assign(metaInfo, json));
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
    data
  }
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
  if (data) { object.body = data; }

  return {
    [CALL_API]: object
  };
};
