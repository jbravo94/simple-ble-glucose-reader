// Based on https://github.com/NightscoutFoundation/xDrip/blob/master/app/src/main/java/com/eveningoutpost/dexdrip/glucosemeter/RecordsCmdTx.java

const OPCODE_REPORT_RECORDS = 0x01;
const ALL_RECORDS = 0x01;
const LESS_THAN_OR_EQUAL = 0x02;
const GREATER_THAN_OR_EQUAL = 0x03;
const WITHIN_RANGE = 0x04;
const FIRST_RECORD = 0x05;
const LAST_RECORD = 0x06;

const FILTER_TYPE_SEQUENCE_NUMBER = 1;
const FILTER_TYPE_USER_FACING_TIME = 2;

export function getAllRecords() {
  return [OPCODE_REPORT_RECORDS, ALL_RECORDS];
}

export function getFirstRecord() {
  return [OPCODE_REPORT_RECORDS, FIRST_RECORD];
}

// TODO test this function
export function getNewerThanSequence(sequence) {
  const data = [];
  data.push(OPCODE_REPORT_RECORDS);
  data.push(GREATER_THAN_OR_EQUAL);
  data.push(FILTER_TYPE_SEQUENCE_NUMBER);
  // Little-endian ordering
  data.push(sequence & 0x00ff);
  data.push((sequence & 0xff00) >> 8);
  return data;
}
