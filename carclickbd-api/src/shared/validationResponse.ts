const validationResponse = (message: string) => {
  const sendValidationResponse = {
    validationResponse: {
      message: message,
    },
  };
  return sendValidationResponse;
};

export default validationResponse;
