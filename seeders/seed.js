import { faker } from "@faker-js/faker";
import { User } from "../models/UserSchema.js";

const createUser = async (numUsers) => {
  try {
    const usersPromise = [];

    for (let i = 0; i < numUsers; i++) {
      const tempUser = await User.create({
        name: faker.person.fullName(),
        bio: faker.person.bio(),
        password: "password",
        username: faker.internet.userName(),
        avatar: {
          url: faker.image.avatar(),
          public_id: faker.system.fileName(),
        },
      });
      usersPromise.push(tempUser);
    }
    await Promise.all(usersPromise);

    process.exit();
  } catch (error) {
    process.exit(1);
  }
};
export { createUser };
