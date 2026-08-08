/**
 * Title: 'Header carousel developed by Masum Rana'
 * Description: ''
 * Author: 'Masum Rana'
 * Date: 30-07-2024
 *
 */

import { Schema, model } from 'mongoose';
import { IHeaderCarouselSlide } from './headerCarousel.interface';

// Mongoose schema for the IHeaderCarouselSlide interface
const HeaderCarouselSchema = new Schema<IHeaderCarouselSlide>({
  slideTitle: {
    type: String,
    required: true,
  },
  slideText: {
    type: String,
    required: true,
  },
  slideButton: {
    type: {
      label: { type: String, required: true },
      link: { type: String, required: true },
    },
    required: true,
  },
  slideBanner: {
    type: String,
    required: true,
  },
});

// Create and export the model based on the schema
export const HeaderCarousel = model<IHeaderCarouselSlide>(
  'HeaderCarousel',
  HeaderCarouselSchema,
);
