const express = require('express');
const app = express();
const excelToJson = require('convert-excel-to-json');
const multer = require('multer');
const { unlink } = require('fs');
const { promisify } = require('util');
const unlinkFile = promisify(unlink);

const storage = multer.diskStorage({
   destination: (req, file, cb) => {
        cb(null, `./uploads`);
   },
    filename: (req, file, cb) => {
        cb(null, `${new Date().getTime()}-${file.originalname}`)
    }
});
const upload = multer({storage});

const { Sequelize, DataTypes, Op  } = require('sequelize');

//Connect PostgresSQL.
const sequelize = new Sequelize(`postgres://${process.env.DBUser}:${process.env.DBPass}@localhost:5432/talent_acquisition`);

const Candidate = sequelize.define('Candidate', {
    candidate_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phone_number: {
        type: DataTypes.STRING,
        allowNull: false
    },
    candidates_data: {
        type: DataTypes.JSONB
    },
    created_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    created_by: {
        type: DataTypes.STRING,
        allowNull: false
    },
    modified_date: {
        type: DataTypes.DATE
    },
    modified_by: {
        type: DataTypes.STRING
    }
}, { tableName: 'candidate_summary', timestamps: false });


const processFile = async (req, res, next) => {
    const result = excelToJson({
        sourceFile: req.file.path,
        header:{
            rows: 1
        },
        columnToKey: {
            '*': '{{columnHeader}}'
        }
    });
    req.excelData = result.Sheet1;
    await unlinkFile(req.file.path);
    next();
}

const validateData = async (req, res, next) => {
    try {
        const possibleCurrency = ['INR', 'USD', 'EUR'];
        const possibleUnits = ['LAKHS', 'CRORES', 'THOUSANDS', 'MILLIONS'];
        const propertyDataTypes = {
            'Name': 'string',
            'Designation': 'string',
            'Company Name': 'string',
            'Experience(Years)': 'number',
            'CTC currency': 'string',
            'CTC': 'number',
            'CTC Type': 'string',
            'Email ID': 'string',
            'Contact Number': 'number',
            'LinkedIn Link': 'string',
            'Location': 'string'
        }
        const errors = [];
        for (let i = 0; i < req.excelData.length; i++) {
            const record = req.excelData[i];
            const arr = [...req.excelData];
            //all fields should have data type validation. Email should be a valid email id
            const propertyKeys = Object.keys(propertyDataTypes);
            propertyKeys.forEach(property => {
                if (!record[property]) {
                    errors.push(`${property} not available in Row ${i + 2}`);
                } else if (typeof record[property] !== propertyDataTypes[property]) {
                    errors.push(`Type of ${property} must be ${propertyDataTypes[property]} in Row ${i + 2}`);
                }
            });
            const atIndex = record['Email ID'].indexOf('@');
            const dotIndex = record['Email ID'].lastIndexOf('.');
            if (atIndex === -1 || dotIndex === -1 || dotIndex < atIndex + 2) {
                errors.push(`Invalid Email ID in Row ${i + 2}`);
            }


            //CTC can Use INR or USD or EUR
            if (!record['CTC currency'] || !possibleCurrency.includes(record['CTC currency'])) {
                errors.push(`CTC currency can be any one of INR or USD or EUR in Row ${i + 2}`);
            }

            //CTC Type can be LAKHS or CRORES when currency is INR for others it must be THOUSANDS or MILLIONS
            if (record['CTC currency'] === 'INR' && record['CTC Type'] !== 'LAKHS' && record['CTC Type'] !== 'CRORES') {
                errors.push(`CTC Type can be LAKHS or CRORES when currency is INR in Row ${i + 2}`);
            }
            if ((record['CTC currency'] === 'USD' || record['CTC currency'] === 'EUR') && record['CTC Type'] !== 'THOUSANDS' && record['CTC Type'] !== 'MILLIONS') {
                errors.push(`CTC Type can be THOUSANDS or MILLIONS when currency is ${record['CTC currency']} in Row ${i + 2}`);
            }
            if (!record['CTC currency'] && !possibleUnits.includes(record['CTC Type'])) {
                errors.push(`CTC Type can be LAKHS or CRORES when currency is INR for others it must be THOUSANDS or MILLIONS in Row ${i + 2}`);
            }

            //Find duplicates based on Name Phone Number and Email ID and send the validation report.
            const nameIndex = arr.findIndex(ele => ele.Name === record.Name);
            const emailIndex = arr.findIndex(ele => ele['Email ID'] === record['Email ID']);
            const contactIndex = arr.findIndex(ele => ele['Contact Number'] === record['Contact Number']);
            if (nameIndex !== i) {
                errors.push(`Name ${record.Name} in row ${i + 2} also has duplicate in row ${nameIndex + 2}`);
            }
            if (emailIndex !== i) {
                errors.push(`Email ID ${record['Email ID']} in row ${i + 2} also has duplicate in row ${nameIndex + 2}`);
            }
            if (contactIndex !== i) {
                errors.push(`Contact Number ${record['Contact Number']} in row ${i + 2} also has duplicate in row ${nameIndex + 2}`);
            }
            const data = await Candidate.findAll({
                attributes: ['name', 'email_id', 'phone_number'],
                where: {
                    [Op.or]: [
                        {name: record.Name},
                        {email_id: record['Email ID']},
                        {phone_number: record['Contact Number'].toString()}
                    ]
                }
            });
            if(data.length) {
                const nameExist = data.find(ele => ele.dataValues.name === record.Name);
                const emailExist = data.find(ele => ele.dataValues.email_id === record['Email ID']);
                const contactExist = data.find(ele => ele.dataValues.phone_number === record['Contact Number'].toString());
                if(nameExist) {
                    errors.push(`Name ${record.Name} in row ${i + 2} already exist`);
                }
                if(emailExist) {
                    errors.push(`Email ID ${record['Email ID']} in row ${i + 2} already exist`);
                }
                if(contactExist) {
                    errors.push(`Contact Number ${record['Contact Number']} in row ${i + 2} already exist`);
                }
            }
        }
        if (errors.length) {
            return res.status(400).send({status: 'failure', message: 'Please resolve the errors and re-upload', errors});
        }
        next();
    } catch (error) {
        console.error(error);
        return res.status(500).send({status: 'failure', message: 'General Error', error});
    }
}

const uploadData = async (req,res) => {
    const status = await Candidate.bulkCreate([{
            name: req.excelData[0]['Name'],
            email_id: req.excelData[0]['Email ID'],
            phone_number: req.excelData[0]['Contact Number'],
            created_date: req.excelData[0][''],
            candidates_data: {
                'ctc': {
                    'value': req.excelData[0]['CTC'],
                    'ctcUnit': req.excelData[0]['CTC Type'],
                    'ctcCurrency': req.excelData[0]['CTC currency']
                },
                'candidateExperience': req.excelData[0]['Experience(Years)'],
                'company': {
                    'name': req.excelData[0]['Company Name']
                },
                'location': {
                    'city': req.excelData[0]['Location']
                },
                'linkedIn': req.excelData[0]['LinkedIn Link']
            },
            created_by: 'test user',
        }]);
    return res.send({ status: 'success', message: 'successfully uploaded', file: req.file, data: status });
}

app.post('/upload-candidates', upload.single('data'), processFile, validateData, uploadData);

sequelize.authenticate().then(() => {
    console.log('Connection has been established successfully.');
    app.listen(9090, async () => console.log('app listening to port 9090'));
}).catch((err) => {
    console.error('Unable to connect to the database:', err);
})
