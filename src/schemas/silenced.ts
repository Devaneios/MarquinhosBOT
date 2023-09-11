import { Schema, model } from 'mongoose';
import { ISilenced } from '../types';

const SilencedSchema = new Schema<ISilenced>({
  id: { required: true, type: String },
  user: { required: true, type: String },
});

const SilencedModel = model('silenced', SilencedSchema);

export default SilencedModel;
