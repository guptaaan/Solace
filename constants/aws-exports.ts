const awsconfig = {
  Auth: {
    Cognito: {
      userPoolId: "us-east-1_LRcX2Vowx",
      userPoolClientId: "2j070renr5uqeui04smm5roenk",
      region: "us-east-1",
      loginWith: {
        username: true,
        email: true,
      },
    },
  },
};

export default awsconfig;
