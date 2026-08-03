import { Box, type BoxProps } from '@mui/material';
import { softShadowDark, softShadowLight } from '../theme';

interface SoftCardProps extends BoxProps {
  padding?: number | string;
  interactive?: boolean;
}

export default function SoftCard({
  children,
  padding = 2.5,
  interactive = false,
  sx,
  ...rest
}: SoftCardProps) {
  return (
    <Box
      {...rest}
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 3,
        boxShadow: (theme) =>
          theme.palette.mode === 'dark' ? softShadowDark : softShadowLight,
        p: padding,
        transition: interactive ? 'transform 0.2s ease, box-shadow 0.2s ease' : undefined,
        ...(interactive
          ? {
              cursor: 'pointer',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark'
                    ? '0 12px 36px rgba(0,0,0,0.45)'
                    : '0 12px 36px rgba(15,23,42,0.1)',
              },
            }
          : {}),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
