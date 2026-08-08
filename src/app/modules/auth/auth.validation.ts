import z from 'zod';

const userLoginZodSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email({ message: 'Invalid email format' }),
    password: z.string({
      required_error: 'Password is required',
    }),
  }),
});

const customerRegisterZodSchema = z.object({
  body: z.object({
    name: z.string(),
    accountType: z.string({ required_error: 'AccountType is required' }),
    contactNo: z.string({ required_error: 'contactNo is required' }),
    email: z.string().email(),
    password: z.string(),
  }),
});

const adminRegisterZodSchema = z.object({
  body: z.object({
    name: z.object({
      firstName: z.string(),
      lastName: z.string().optional(),
    }),
    email: z.string().email(),
    password: z.string(),
  }),
});

const refreshTokenZodSchema = z.object({
  cookies: z.object({
    refreshToken: z.string({
      required_error: 'Refresh Token is required',
    }),
  }),
});

const changePasswordZodSchema = z.object({
  body: z.object({
    oldPassword: z.string({
      required_error: 'Old password  is required',
    }),
    newPassword: z.string({
      required_error: 'new password  is required',
    }),
  }),
});

export const authValidationSchema = {
  customerRegisterZodSchema,
  userLoginZodSchema,
  adminRegisterZodSchema,
  refreshTokenZodSchema,
  changePasswordZodSchema,
};
