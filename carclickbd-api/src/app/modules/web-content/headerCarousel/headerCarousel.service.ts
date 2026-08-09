import { IHeaderCarouselSlide } from './headerCarousel.interface';
import { HeaderCarousel } from './headerCarousel.model';

//
const createSlide = async (
  payload: IHeaderCarouselSlide,
): Promise<IHeaderCarouselSlide | null> => {
  const result = await HeaderCarousel.create(payload);
  return result;
};

// get slides
const getAllSlide = async (): Promise<IHeaderCarouselSlide[] | null> => {
  const result = await HeaderCarousel.find({});
  return result;
};

// update Header CaroselSlide
const updateSlide = async (
  payload: Partial<IHeaderCarouselSlide>,
  id: string,
): Promise<IHeaderCarouselSlide | null> => {
  const result = await HeaderCarousel.findOneAndUpdate(
    { _id: id },
    { payload },
  );
  return result;
};

// update Header CaroselSlide
const deleteSlide = async (
  id: string,
): Promise<IHeaderCarouselSlide | null> => {
  const result = await HeaderCarousel.findByIdAndDelete({ _id: id });
  return result;
};

export const headerCarouselSliderService = {
  createSlide,
  getAllSlide,
  updateSlide,
  deleteSlide,
};
