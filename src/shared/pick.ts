/**
 * Title: 'By using pick I Picking filtering and searching data'
 * Description: ''
 * Author: 'Masum Rana'
 * Date: 27-12-2023
 *
 */

const pick = <T extends object, k extends keyof T>(
  obj: T,
  keys: k[],
): Partial<T> => {
  const finalObj: Partial<T> = {};

  for (const key of keys) {
    if (obj && Object.hasOwnProperty.call(obj, key)) {
      finalObj[key] = obj[key];
    }
  }
  return finalObj;
};

export default pick;
