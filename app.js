require('dotenv').config(); // Для загрузки переменных окружения из файла .env
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Подключаем uuid для генерации id
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3'); // AWS SDK для работы с S3
const app = express();
const upload = multer({ dest: 'uploads/' }); // Временная папка для загрузки файлов перед отправкой в S3

// Настройка клиента S3
const s3 = new S3Client({
  region: 'eu-north-1', // Регион вашего бакета
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Ваш Access Key ID
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY // Ваш Secret Access Key
  }
});

let recipes = require('./recipes.json'); // Загрузка данных рецептов из JSON

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Функция для очистки папки uploads
function cleanUploads() {
  const uploadsDir = path.join(__dirname, 'public', 'uploads');

  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      console.error(`Ошибка чтения папки uploads: ${err}`);
      return;
    }

    // Список всех фото, которые используются в рецептах
    const usedPhotos = recipes.map(recipe => recipe.photo).filter(photo => photo);

    // Проверяем каждый файл в папке uploads
    files.forEach(file => {
      if (!usedPhotos.includes(file)) {
        // Файл не используется, удаляем его
        const filePath = path.join(uploadsDir, file);
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(`Ошибка при удалении файла: ${filePath}`, err);
          } else {
            console.log(`Файл успешно удален: ${filePath}`);
          }
        });
      }
    });
  });
}

// Очищаем папку uploads при запуске приложения
cleanUploads();

// Функция для загрузки файла в S3
async function uploadFileToS3(file) {
  const fileStream = fs.createReadStream(file.path);

  const uploadParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: file.filename, // Имя файла в S3
    Body: fileStream,
    ContentType: file.mimetype
  };

  try {
    const data = await s3.send(new PutObjectCommand(uploadParams));
    return `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${file.filename}`; // Возвращаем URL загруженного файла
  } catch (err) {
    console.error('Ошибка загрузки файла в S3:', err);
    throw err;
  }
}

// Главная страница
app.get('/', (req, res) => {
  const fishDishes = recipes.filter(recipe => recipe.category === 'fish');
  const meatDishes = recipes.filter(recipe => recipe.category === 'meat');
  const sauces = recipes.filter(recipe => recipe.category === 'sauce');

  if (req.xhr) {  // Если это AJAX-запрос, возвращаем только контент
    res.render('index', { fishDishes, meatDishes, sauces });
  } else {  // Если это обычный запрос, рендерим с layout
    res.render('layout', { body: 'index', fishDishes, meatDishes, sauces });
  }
});

// Страница для добавления рецепта
app.get('/add-recipe', (req, res) => {
  if (req.xhr) {
    res.render('add-recipe', { recipes });
  } else {
    res.render('layout', { body: 'add-recipe', recipes });
  }
});

// Обработка добавления нового рецепта
app.post('/add-recipe', upload.single('photo'), async (req, res) => {
  const newRecipe = {
    id: uuidv4(), // Генерация уникального id
    title: req.body.title,
    category: req.body.category, // Категория рецепта
    ingredients: req.body.ingredients,
    ingredientWeights: req.body.ingredientWeights,
    totalWeight: req.body.totalWeight,
    preparation: req.body.description,
    photo: null
  };

  if (req.file) {
    try {
      const photoUrl = await uploadFileToS3(req.file);
      newRecipe.photo = photoUrl;
      fs.unlinkSync(req.file.path); // Удаляем локальный файл после загрузки
    } catch (error) {
      console.error('Ошибка загрузки в S3:', error);
      return res.status(500).send('Ошибка загрузки файла.');
    }
  }

  recipes.push(newRecipe); // Добавляем новый рецепт в массив

  // Сохраняем массив рецептов в JSON-файл
  fs.writeFileSync('./recipes.json', JSON.stringify(recipes, null, 2));

  console.log(`Рецепт "${newRecipe.title}" успешно добавлен с id: ${newRecipe.id}`);

  res.redirect('/');
});

// Маршрут для удаления рецепта
app.post('/delete-recipe/:id', async (req, res) => {
  const recipeId = req.params.id;
  const recipeIndex = recipes.findIndex(recipe => recipe.id === recipeId);

  if (recipeIndex === -1) {
    console.error(`Рецепт с id ${recipeId} не найден для удаления.`);
    return res.status(404).json({ error: 'Рецепт не найден' }); // Отправляем JSON-ответ вместо редиректа
  }

  const recipe = recipes[recipeIndex];

  // Проверка, существует ли фото
  if (recipe.photo) {
    const photoKey = recipe.photo.split('/').pop();

    try {
      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: photoKey
      }));
      console.log('Фото успешно удалено из S3:', photoKey);
    } catch (err) {
      console.error('Ошибка удаления файла из S3:', err);
    }
  }

  // Удаляем рецепт из массива
  recipes.splice(recipeIndex, 1);

  // Сохраняем изменения в JSON-файле
  fs.writeFileSync('./recipes.json', JSON.stringify(recipes, null, 2));

  // Отправляем ответ без редиректа
  res.json({ success: true });
});

// Маршрут для редактирования рецепта
app.get('/edit-recipe/:id', (req, res) => {
  const recipeId = req.params.id;
  const recipe = recipes.find(recipe => recipe.id === recipeId);

  if (!recipe) {
    console.error(`Рецепт с id ${recipeId} не найден для редактирования.`);
    return res.status(404).send('Рецепт не найден');
  }

  if (req.xhr) {
    res.render('edit-recipe', { recipe });
  } else {
    res.render('layout', { body: 'edit-recipe', recipe });
  }
});

// Обработка редактирования рецепта
app.post('/edit-recipe/:id', upload.single('photo'), async (req, res) => {
  const recipeId = req.params.id;
  const recipeIndex = recipes.findIndex(recipe => recipe.id === recipeId);

  if (recipeIndex === -1) {
    console.error(`Рецепт с id ${recipeId} не найден для обновления.`);
    return res.status(404).send('Рецепт не найден');
  }

  const updatedRecipe = {
    ...recipes[recipeIndex], // Сохраняем оригинальный id и другие неизменные поля
    title: req.body.title,
    ingredients: req.body.ingredients, // Массив ингредиентов
    ingredientWeights: req.body.ingredientWeights, // Массив весов ингредиентов
    totalWeight: req.body.totalWeight, // Общий вес
    preparation: req.body.description,
    photo: req.file ? req.file.filename : recipes[recipeIndex].photo // Обновляем фото, если загружено новое
  };

  if (req.file) {
    try {
      const photoUrl = await uploadFileToS3(req.file);
      updatedRecipe.photo = photoUrl;
      fs.unlinkSync(req.file.path); // Удаляем локальный файл после загрузки
    } catch (error) {
      console.error('Ошибка загрузки в S3:', error);
      return res.status(500).send('Ошибка загрузки файла.');
    }
  }

  // Обновляем рецепт в массиве
  recipes[recipeIndex] = updatedRecipe;

  // Сохраняем обновленный рецепт в JSON
  fs.writeFileSync('./recipes.json', JSON.stringify(recipes, null, 2));

  console.log(`Рецепт "${updatedRecipe.title}" успешно обновлен.`);

  res.redirect('/');
});

// Маршрут для отображения рецепта
app.get('/recipe/:id', (req, res) => {
  const recipeId = req.params.id;
  const recipe = recipes.find(recipe => recipe.id === recipeId);

  if (!recipe) {
    console.error(`Рецепт с id ${recipeId} не найден для отображения.`);
    return res.status(404).send('Рецепт не найден');
  }

  if (req.xhr) {
    res.render('recipe-detail', { recipe });
  } else {
    res.render('layout', { body: 'recipe-detail', recipe });
  }
});

// Запуск сервера
app.listen(3000, () => {
  console.log('Сервер запущен на http://localhost:3000');
});







