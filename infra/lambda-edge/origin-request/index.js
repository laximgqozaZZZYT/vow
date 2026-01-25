'use strict';

/**
 * Lambda@Edge Origin Request function
 * 
 * Rewrites the Host header to match the Amplify origin domain
 * This is necessary because CloudFront forwards the original Host header
 * and Amplify rejects requests with mismatched Host headers
 */

const AMPLIFY_DOMAIN = 'develop.do1k9oyyorn24.amplifyapp.com';

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  
  // Set Host header to Amplify domain
  request.headers['host'] = [{ key: 'Host', value: AMPLIFY_DOMAIN }];
  
  return request;
};
