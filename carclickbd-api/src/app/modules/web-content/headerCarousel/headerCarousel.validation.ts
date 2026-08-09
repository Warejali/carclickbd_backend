import { z } from 'zod';

const headerCarouselZodValidationSchema = z.object({
  body: z.object({
    slideTitle: z.string({
      required_error: 'slideTitle is required',
    }),
    slideText: z.string({
      required_error: 'slideText is required',
    }),
    slideButton: z.object({
      label: z.string({
        required_error: 'slideButton.label is required',
      }),
      link: z.string({
        required_error: 'slideButton.link is required',
      }),
    }),
    slideBanner: z.string({
      required_error: 'slideBanner is required',
    }),
  }),
});

export const HeaderCarouselValidation = {
  headerCarouselZodValidationSchema,
};
