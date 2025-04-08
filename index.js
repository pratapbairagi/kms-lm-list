const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const cors = require('cors');
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const moment = require('moment');

const app = express();
const port = 5000;

// Middleware
app.use(cors({
  credentials: true,
  origin: ["http://localhost:3001", "http://localhost:3000", "http://localhost:5001", "https://kms-lm-list.vercel.app"],
  methods: ["GET", "PUT", "POST", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Middleware to parse JSON and form data
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(bodyParser.json({ limit: "25mb" }));
app.use(cookieParser());

// File storage configuration for multer (you can customize this as per your needs)
// const upload = multer({
//   dest: 'uploads/', // destination folder for uploaded files
//   limits: { fileSize: 10 * 1024 * 1024 } // 10MB file size limit
// });

const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB file size limit
});


// Endpoint to send bulk email
app.post('/api/send-bulk-email/:memberNumber', async (req, res) => {
  try {
    
      // console.log("test email ", req.body)
    // const { subject, htmlContent, recipients } = req.body; // recipients is an array of email addresses
    const data = req.body; // recipients is an array of email addresses
    const {memberNumber} = req.params;

    let arrayreceivers = []

    if(typeof data.EMAIL === "string"){
      arrayreceivers = [data.EMAIL]
    }
    else{
      arrayreceivers = data.EMAIL
    }


    // Return success message
    // res.status(200).json({ message: 'Emails sent successfully', result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error sending emails', error: error.message });
  }
});


// Route to get all uploaded files (JSON format)
app.get('/api/files', async (req, res) => {
  const uploadsDir = path.join(__dirname, "uploads")
  const files = await new Promise((resolve, reject) => {
    fs.readdir(uploadsDir, (err, files) => {
      if (err) {
        reject({ message: 'Error reading the uploads directory' });
      } else {
        resolve(files);
      }
    });

  });
  res.status(200).json({ files })
});


function convertExcelDate(excelDate) {
  if (isNaN(excelDate)) {
    return excelDate
  }
  else {
    // // Excel date system starts at December 31, 1899 (Day 0 in Excel)
    // // Moment.js starts from 1970-01-01, so we need to calculate the offset between these two
    // const excelStartDate = moment('1899-12-31');  // Start date for Excel serial dates

    // // Moment adds days to the start date. Excel serial number needs to be treated directly as days.
    // const resultDate = excelStartDate.add(excelDate, 'days');

    // return resultDate;

    const excelEpoch = new Date(1900, 0, 1); // January 1, 1900
  const jsDate = new Date(excelEpoch.getTime() + (excelDate - 2) * 86400000); // Excel's epoch starts from 1900, but with an offset (Excel starts counting from 1, so subtract 2)

  const year = jsDate.getFullYear(); // Get the full year (e.g., 2024)
  
  // Get the month (0-indexed, so add 1 for correct month) and pad with leading zero if necessary
  const month = String(jsDate.getMonth() + 1).padStart(2, '0'); // Ensure month is between 01-12

  const day = String(jsDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;

  // return jsDate;
  }
}

// Route to upload file (parse and save as JSON)
// app.post('/api/upload', async (req, res) => {
//   const { data, fileName } = req.body; // Receive array data and custom file name

//   if (!data || !Array.isArray(data) || data.length === 0) {
//     return res.status(400).send({ message: 'No data or invalid data format received' });
//   }

//   if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
//     return res.status(400).send({ message: 'Invalid or missing file name' });
//   }

//   // Ensure the file name has the .xlsx extension
//   const finalFileName = fileName.endsWith('.xlsx') ? fileName : fileName + '.xlsx';
//   const filePath = path.join(__dirname, 'uploads', finalFileName);

//   try {

//     let datas = []

//     let headers = data[0];

//     let filteredData = data.filter(v => v.length > 0);
//     filteredData.map((v, i) => {
//       let formated = {};
//       headers.forEach((val, ind) => {
//         if (val !== null) {
//           formated[val] = v[ind] || "N/A"
//         }
//       })
//       datas.push(formated)
//     });

//     datas = datas.map((v) => {
//       if (typeof Number(v.DOB) === "number") {
//         // return { ...v, DOB: typeof v.DOB === "number" ? convertExcelDate(v.DOB).format("YYYY-MM-DD") : v.DOB }
//         return { ...v, DOB: typeof v.DOB === "number" ? convertExcelDate(v.DOB) : v.DOB }
//       } else {
//         return { ...v }

//       }
//     })
//     // filteredData = filteredData.map(v=> v.filter(vv=> vv !== null) )

//     const uploadsDir = path.join(__dirname, 'uploads');

//     // Check if the 'uploads' directory exists
//     if (!fs.existsSync(uploadsDir)) {
//       return res.status(404).json({ message: 'Uploads directory not found' });
//     }

//     const files = await new Promise((resolve, reject) => {
//       fs.readdir(uploadsDir, (err, files) => {
//         if (err) {
//           reject({ message: 'Error reading the uploads directory' });
//         } else {
//           resolve(files);
//         }
//       });
//     });

//     // Convert the array data into a worksheet (Excel format)
//     const ws = XLSX.utils.json_to_sheet(datas.filter((v, i) => i !== 0));

//     // Create a new workbook and append the worksheet
//     const wb = XLSX.utils.book_new();
//     XLSX.utils.book_append_sheet(wb, ws, 'MembersData');

//     // Write the workbook to the file
//     XLSX.writeFile(wb, filePath);


//     // Send the converted array data back to the client (no file path)
//     res.status(201).json({
//       message: 'Excel file created successfully',
//       data: datas, // Returning the original data back to the client
//       fileName: files, // Send the file name back (just in case)
//     });
//   } catch (error) {
//     console.error('Error generating the Excel file:', error);
//     return res.status(500).send({ message: error });
//   }
// });

// Modified upload endpoint to handle direct file uploads
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    // Process Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Process data as before
    let datas = [];
    let headers = jsonData[0];

    let filteredData = jsonData.filter(v => v.length > 0);
    filteredData.map((v, i) => {
      let formated = {};
      headers.forEach((val, ind) => {
        if (val !== null) {
          formated[val] = v[ind] || "N/A"
        }
      })
      datas.push(formated)
    });

    datas = datas.map((v) => {
      if (typeof Number(v.DOB) === "number") {
        return { ...v, DOB: typeof v.DOB === "number" ? convertExcelDate(v.DOB) : v.DOB }
      } else {
        return v
      }
    });

    // Save to uploads directory if needed (temporary in Vercel)
    const filePath = path.join(uploadsDir, fileName);
    const ws = XLSX.utils.json_to_sheet(datas.filter((v, i) => i !== 0));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MembersData');
    XLSX.writeFile(wb, filePath);

    res.status(201).json({
      message: 'Excel file processed successfully',
      data: datas,
      fileName: fileName,
      headers: headers
    });

  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ message: 'Error processing file', error: error.message });
  }
});

// Route to get data from a specific file
app.get('/api/file/data/:fileName', (req, res) => {
  const { fileName } = req.params;
  const filePath = path.join(__dirname, 'uploads', fileName);

  if (fs.existsSync(filePath)) {
    // Read the Excel file using xlsx library
    const fileData = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileData, { type: 'buffer' });

    // Assuming you want to parse the first sheet of the workbook
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convert sheet to JSON
    const members = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const headers = members[0];

    let datas = [];

    members.map((v, i) => {
      let formated = {};
      headers.forEach((val, ind) => {
        if (val !== null) {
          formated[val] = v[ind] || "N/A"
        }
      })
      datas.push(formated)
    });

    // Send the JSON data back to the client
    res.status(200).json({ members: datas, headers: members[0] });
  } else {
    res.status(404).send({ message: 'File not found' });
  }
});

// Route to delete a file
app.delete('/api/delete-file/:fileName', (req, res) => {
  const { fileName } = req.params;
  const filePath = path.join(__dirname, 'uploads', fileName);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.status(200).json({ message: 'File deleted successfully' });
  } else {
    res.status(404).send({ message: 'File not found' });
  }
});

// Route to export file (return file as a downloadable file)
app.get('/api/export-file/:fileName', async (req, res) => {
  const { fileName } = req.params;
  const filePath = path.join(__dirname, 'uploads', fileName);

  if (fs.existsSync(filePath)) {
    // Read the Excel file as binary data
    const fileData = fs.readFileSync(filePath);

    // Set the appropriate headers for Excel file download
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Send the file data as response
    res.send(fileData);
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});


function replaceEmptyValuesWithNA(data) {
  // Loop through the keys of the object
  for (let key in data) {
    if (data.hasOwnProperty(key)) {
      // If the value is an empty string, replace it with 'N/A'
      if (data[key] === '') {
        data[key] = 'N/A';
      }
    }
  }
  return data;
}

// Route to update a file (this is a simple implementation based on your frontend code)
app.put('/api/update-file', (req, res) => {
  const { data, fileName } = req.body;
  console.log("updated data ", req.body)
  const filePath = path.join(__dirname, 'uploads', fileName);

  if (fs.existsSync(filePath)) {
    // Read the Excel file using xlsx library
    const fileData = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileData, { type: 'buffer' });

    // Assuming you want to parse the first sheet of the workbook
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convert sheet to JSON
    const members = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const headers = members[0];

    let datas = [];

    members.map((v, i) => {
      let formated = {};
      headers.forEach((val, ind) => {
        if (val !== null) {
          formated[val] = v[ind] || "N/A"
        }
      })
      datas.push(formated)
    });

    datas = datas.map((v, i) => {
      if (v.MEMBER === data.MEMBER) {
        return replaceEmptyValuesWithNA(data)
      }
      else {
        return v
      }
    });

    // Convert the array data into a worksheet (Excel format)
    const ws = XLSX.utils.json_to_sheet(datas.filter((v, i) => i !== 0));

    // Create a new workbook and append the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MembersData');

    // Write the workbook to the file
    XLSX.writeFile(wb, filePath);

    res.status(200).json({
      data: datas.filter((v,i)=> i !== 0),
    })
  } else {
    res.status(404).send({ message: 'File not found' });
  }
});

// Route to delete a member from a file (based on your frontend code)
app.put('/api/delete-member', (req, res) => {
  const { data, fileName, memberNumber } = req.body;
  console.log("filename ", fileName)
  console.log("memberNumber ", memberNumber)
  const filePath = path.join(__dirname, 'uploads', fileName);

  if (fs.existsSync(filePath)) {
    const fileData = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileData, { type: 'buffer' });

    // Assuming you want to parse the first sheet of the workbook
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convert sheet to JSON
    const members = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const headers = members[0];

    let datas = [];

    members.map((v, i) => {
      let formated = {};
      headers.forEach((val, ind) => {
        if (val !== null) {
          formated[val] = v[ind] || "N/A"
        }
      })
      datas.push(formated)
    });

    datas = datas.filter((v, i) => v.MEMBER !== memberNumber );

    // Convert the array data into a worksheet (Excel format)
    const ws = XLSX.utils.json_to_sheet(datas.filter((v, i) => i !== 0));

    // Create a new workbook and append the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MembersData');

    // Write the workbook to the file
    XLSX.writeFile(wb, filePath);

    res.status(200).json({ data : datas.filter((v,i)=> i !== 0) })


  } else {
    res.status(404).send({ message: 'File not found' });
  }
});

app.use(express.static(path.join(__dirname, "./client/build")));
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
});

function outer() {
  let counter = 0;
  console.log("outer console 1st ", counter);
  function inner() {
    counter++;
    console.log(counter);  // This prints each time inner() is called
  }

  console.log("outer console 2nd ", counter);  // This prints once when outer() is called
  return inner;  // Returning the inner function
  console.log("outer console end ", counter);
}

const increment = outer();  // Logs "outer console 0"
increment(); // Output: 1
increment(); // Output: 2
increment(); // Output: 3


// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


