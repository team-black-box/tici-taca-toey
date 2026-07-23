export const extractValueAndSet =
  (setter: (value: string) => void) =>
  (event: { target: { value: string } }) =>
    setter(event.target.value);
