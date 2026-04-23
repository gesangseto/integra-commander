import { Box, Button, Grid, Paper, Typography } from '@mui/material';
import { useState } from 'react';
import { lighten } from '@mui/material/styles';

function Footer() {
  const [totalLevel, setTotalLevel] = useState(2);
  return (
    <Paper sx={{ borderRadius: 2, my: 0.5 }}>
      <Typography>Ini Footer</Typography>
    </Paper>
  );
}
const GridRowspan = (props) => {
  const { pacakaging_level } = props;
  let colorField = '#646464';
  const getColor = () => {
    let color = '#ed6e13';
    if (pacakaging_level == 2) color = '#0567e7';
    if (pacakaging_level == 3) color = '#4dc000';
    if (pacakaging_level == 4) color = '#b5c900';
    return color;
  };
  let sxBoxLeft = {
    flew: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    borderRadius: 2,
    backgroundColor: getColor(),
    color: 'white',
    p: 0.5,
  };
  let sxBoxRight = {
    minWidth: 300,
    display: 'flex',
    flexDirection: 'column',
    color: 'white',
    justifyContent: 'center',
    gap: 0.2,
  };
  let sxTitle = {
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lighten(getColor(), 0.3),
    color: 'white',
    textAlign: 'center',
  };
  let sxField = {
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lighten(colorField, 0.3),
    color: 'white',
  };

  return (
    <Box
      gap={0.2}
      display="flex"
      justifyContent={pacakaging_level % 2 == 0 ? 'flex-start' : 'flex-end'}
      sx={{ display: 'flex', width: '100%' }}
    >
      <Button sx={sxBoxLeft}>
        <Typography variant="h4">L{pacakaging_level}</Typography>
        <Typography variant="h4" fontWeight={'bold'}>
          MB
        </Typography>
        <Typography variant="h6">Master Box</Typography>
      </Button>
      {/* {BAGIAN DATA} */}
      {pacakaging_level == 1 ? (
        <Box sx={sxBoxRight}>
          <Box display="flex" gap={0.2}>
            <Typography sx={sxTitle}>TOTAL ACTIVE</Typography>
            <Typography sx={sxField}>150</Typography>
          </Box>
          <Box display="flex" gap={0.2}>
            <Typography sx={sxTitle}>TERAGGREGASI</Typography>
            <Typography sx={sxField}>150</Typography>
          </Box>
          <Box display="flex" gap={0.2} minHeight={50}>
            <Typography sx={{ ...sxTitle, backgroundColor: getColor() }}>
              BELUM TERAGGREGASI
            </Typography>
            <Typography sx={{ ...sxField, backgroundColor: colorField }}>
              150
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={sxBoxRight}>
          <Box display="flex" gap={0.2}>
            <Typography sx={sxTitle}>FULL</Typography>
            <Typography sx={sxField}>100</Typography>
          </Box>
          <Box display="flex" gap={0.2}>
            <Typography sx={sxTitle}>PARTIAL</Typography>
            <Typography sx={sxField}>1</Typography>
          </Box>
          <Box display="flex" gap={0.2} minHeight={50}>
            <Typography sx={{ ...sxTitle, backgroundColor: getColor() }}>
              TOTAL
            </Typography>
            <Typography sx={{ ...sxField, backgroundColor: colorField }}>
              150
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Footer;
