import { getShort, getSfloat16 } from './DataTypeHelper';

// Based on https://github.com/NightscoutFoundation/xDrip/blob/c48ef307c6dd28f6f6027a775a2b82c89a5b281d/app/src/main/java/com/eveningoutpost/dexdrip/glucosemeter/GlucoseReadingRx.java#L14
export default class GlucoseReadingRx {
  constructor(packet) {
    
    // Commented because some glucose devices do not have this restriction
    /*
    if (packet.length < 14) {
      return;
    }
    */

    const data = packet;

    const flags = data[0];
    const timeOffsetPresent = (flags & 0x01) > 0;
    const typeAndLocationPresent = (flags & 0x02) > 0;
    const concentrationUnitKgL = (flags & 0x04) === 0;
    const sensorStatusAnnunciationPresent = (flags & 0x08) > 0;
    const contextInfoFollows = (flags & 0x10) > 0;

    this.sequence = getShort(data, 1);
    this.year = getShort(data, 3);

    this.month = data[5];
    this.day = data[6];
    this.hour = data[7];
    this.minute = data[8];
    this.second = data[9];

    let index = 10;
    if (timeOffsetPresent) {
      this.offset = getShort(data, index);
      index += 2;
    }

    if (concentrationUnitKgL) {
      const kgl = getSfloat16(data, index);
      this.mgdl = kgl * 100000;
    } else {
      const mol = getSfloat16(data, index);
      const MMOLL_TO_MGDL = 18.0182;
      this.mgdl = mol * 1000 * MMOLL_TO_MGDL;
    }

    //Applying JavaScript precision fix
    this.mgdl = parseFloat(parseFloat(this.mgdl).toFixed(5));

    index += 2;

    if (typeAndLocationPresent) {
      const typeAndLocation = data[index];
      this.sampleLocation = (typeAndLocation & 0xf0) >> 4;
      this.sampleType = typeAndLocation & 0x0f;
      index++;
    }

    if (sensorStatusAnnunciationPresent) {
      this.status = data[index];
    }

    // TODO Implement offset
    const date = new Date(
      this.year,
      this.month - 1,
      this.day,
      this.hour,
      this.minute,
      this.second,
    );

    this.time = date.toLocaleString('de-DE', { timeZone: 'UTC' });
  }

  toString() {
    return (
      'Glucose data: mg/dl: ' +
      (this.mgdl < 0 ? '-INFINITY' : this.mgdl) +
      '  seq:' +
      this.sequence +
      '  time: ' +
      this.time
    );
  }
}
