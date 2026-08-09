import { Response, Request } from 'express';
import catchAsync from '../../../../shared/catchAsync';
import sendResponse from '../../../../shared/sendResponse';
import { IHeaderCarouselSlide } from './headerCarousel.interface';
import httpStatus from 'http-status';
import { headerCarouselSliderService } from './headerCarousel.service';

// CreateSlide
const createSlide = catchAsync(async (req: Request, res: Response) => {
  const { ...slideData } = req.body;
  console.log(slideData);

  const result = await headerCarouselSliderService.createSlide(slideData);
  sendResponse<IHeaderCarouselSlide>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'header slide created successfully !',
    data: result,
  });
});

// Get all slide
const getAllSlide = catchAsync(async (req: Request, res: Response) => {
  const result = await headerCarouselSliderService.getAllSlide();
  sendResponse<IHeaderCarouselSlide[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Slides fatched successfully !',
    data: result,
  });
});

// Update slide
const updateSlide = catchAsync(async (req: Request, res: Response) => {
  const slideId = req.params.id;
  const { ...slideData } = req.body;

  const result = await headerCarouselSliderService.updateSlide(
    slideData,
    slideId,
  );
  sendResponse<IHeaderCarouselSlide>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'header slide updated successfully !',
    data: result,
  });
});

//  delete slide
const deleteSlide = catchAsync(async (req: Request, res: Response) => {
  const slideId = req.params.id;

  const result = await headerCarouselSliderService.deleteSlide(slideId);
  sendResponse<IHeaderCarouselSlide>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'header slide created successfully !',
    data: result,
  });
});

export const HeaderCarouselSlideController = {
  createSlide,
  updateSlide,
  getAllSlide,
  deleteSlide,
};
