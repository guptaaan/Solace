export const awsConfig = {
  region: "us-east-1",
  userPoolId: "us-east-1_LRcX2Vowx",
  userPoolWebClientId: "2j070renr5uqeui04smm5roenk",

  oauth: {
    domain: "us-east-1lrcx2vowx.auth.us-east-1.amazoncognito.com",
    scope: ["email", "openid", "profile"],
    redirectSignIn: "exp://localhost",  
    redirectSignOut: "exp://localhost",
    responseType: "code"
  }
};
    