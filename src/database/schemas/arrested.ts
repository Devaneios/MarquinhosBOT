import { Schema, model } from 'mongoose';
import { IArrested } from '../../types';

const ArrestedSchema = new Schema<IArrested>({
  id: { required: true, type: String },
  user: { required: true, type: String },
});

const ArrestedModel = model('arrested', ArrestedSchema);

export default ArrestedModel;
