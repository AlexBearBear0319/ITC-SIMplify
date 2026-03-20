# Project Documentation

## Project Overview
This project is a web application designed to [briefly describe the purpose of the project]. The application is built using Next.js, TypeScript, and Supabase for backend services. The project is structured to ensure modularity and scalability.

---

## Team Roles and Responsibilities

### Alex (Project and Tech Lead)
- Set up the GitHub repository and database.
- Assist all team members as needed.
- Responsible for backend development and API logic.

### Ameer (Backend Lead)
- Develop backend logic for all parts of the application.
- Collaborate with Alex for backend-related tasks.

### Kimbery (Lead UI/UX Designer)
- Design the wireframe for the application.
- Set the standard font and color codes for the entire website.

### Helen & Chris Phoo (Frontend Developers + Styling)
- Develop the frontend pages and components.
- Apply CSS styling to match Kimbery's design.
- Integrate components into the layout and ensure proper functionality.

---

## Project Structure

```
eslint.config.mjs
next-env.d.ts
next.config.ts
package.json
postcss.config.mjs
README.md
tsconfig.json
public/
src/
  app/
    globals.css
    layout.tsx
    page.tsx
  components/
    features/
      InteractiveMap.tsx
      SearchBar.tsx
    layout/
      Sidebar.tsx
  lib/
    api/
      locations.ts
  types/
    database.types.ts
  utils/
    supabase/
      client.ts
      server.ts
```

### Key Folders and Files
- **`src/app/`**: Contains the main application files, including global styles (`globals.css`), the main layout (`layout.tsx`), and the homepage (`page.tsx`).
- **`src/components/`**: Contains reusable components. Subfolders are organized by feature or layout.
- **`src/lib/api/`**: Contains API-related logic and functions.
- **`src/types/`**: Contains TypeScript type definitions.
- **`src/utils/supabase/`**: Contains Supabase client and server configurations.

---

## Guidelines for Frontend Development

### Adding New Pages
1. Create a new file in the `src/app/` directory. For example, to create a new page called `About`, add a file named `about.tsx`.
2. Use the existing `page.tsx` as a reference for setting up the new page.
3. Import and use components from the `src/components/` directory as needed.

### Creating and Using Components
1. Add new components to the appropriate subfolder in `src/components/`.
   - For example, if the component is related to the layout, add it to `src/components/layout/`.
   - If it is a feature-specific component, add it to `src/components/features/`.
2. Follow the structure and coding style of existing components like `InteractiveMap.tsx` or `SearchBar.tsx`.
3. Import the component into the relevant page or layout file and use it as needed.

### Applying CSS
1. Use the `globals.css` file in `src/app/` for global styles.
2. For component-specific styles, use CSS modules. Create a `.module.css` file in the same directory as the component.
   - For example, if you create a `Header.tsx` component, add a `Header.module.css` file in the same directory.
3. Follow the design guidelines set by Kimbery, including fonts, colors, and spacing.

---

## Guidelines for Backend Development

### Adding API Functions
1. Add new API functions to the `src/lib/api/` directory.
2. Use `locations.ts` as a reference for creating new API functions.
3. Ensure that all API functions are properly tested before integration.

### Applying SQL Queries and Integrating with Supabase
1. Use the `client.ts` and `server.ts` files in `src/utils/supabase/` to interact with the Supabase database.
2. Write SQL queries directly in the Supabase dashboard or use the Supabase client in your code.
3. Test the queries in the Supabase dashboard before integrating them into the application.
4. Document any new database tables or changes for the team.

---

## Integration Instructions

### Integrating Components into `layout.tsx`
1. Import the component into `layout.tsx`.
   - Example: `import Sidebar from '../components/layout/Sidebar';`
2. Add the component to the layout structure where it is needed.
   - Example:
     ```tsx
     <div>
       <Sidebar />
       <main>{children}</main>
     </div>
     ```

### Testing the Integration
1. Run the application locally using the development server.
   - Use the command: `npm run dev`.
2. Test the new page or component in the browser to ensure it works as expected.
3. Check the browser console for any errors and fix them as needed.

---

## Next Steps for the Team

### Alex
- Continue working on the backend logic and API functions in `src/lib/api/`.
- Assist team members with any technical challenges.

### Ameer
- Focus on implementing backend logic for the remaining features.
- Collaborate with Alex to ensure smooth integration with the frontend.

### Kimbery
- Finalize the wireframe and share it with the team.
- Provide the standard font and color codes for the project.
- Review the frontend implementation to ensure it aligns with the design.

### Helen & Chris Phoo
- Refer to the existing `page.tsx` and `layout.tsx` files to understand the structure of the application.
- Create new pages in the `src/app/` directory as per the wireframe.
- Develop new components and add them to the appropriate subfolders in `src/components/`.
- Apply CSS styling to the components and pages, following Kimbery's design guidelines.
- Test the pages and components locally using the development server.

---

Feel free to reach out to Alex for any assistance or clarification. Happy coding!