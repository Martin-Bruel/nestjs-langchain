/** Runs an observer method. A throw or a rejection is reported and swallowed. */
export const notify = (
  call: () => void | Promise<void>,
  onFailure: (error: unknown) => void,
): void => {
  try {
    void Promise.resolve(call()).catch(onFailure);
  } catch (error) {
    onFailure(error);
  }
};
