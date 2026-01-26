// migration: add parent_id to roles table for hierarchical roles
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add parent_id column to roles table
    await queryInterface.addColumn('roles', 'parent_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'roles',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add index for parent_id for better query performance
    await queryInterface.addIndex('roles', ['parent_id'], {
      name: 'idx_roles_parent_id'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('roles', 'idx_roles_parent_id');

    // Remove column
    await queryInterface.removeColumn('roles', 'parent_id');
  }
};
